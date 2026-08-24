const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

let crawlerStatus = {
    estado: 'Inativo',
    encomendasLidas: 0,
    totalEncomendas: 0,
    erro: null
};

app.get('/api/crawler-status', (req, res) => {
    res.json(crawlerStatus);
});

app.post('/api/crawler', async (req, res) => {
    const { email, password, targetDate } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    crawlerStatus = {
        estado: 'Iniciando extração',
        encomendasLidas: 0,
        totalEncomendas: 0,
        erro: null
    };

    console.log(`Iniciando crawler para o usuário: ${email}`);

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Login
        await page.goto('https://perform.lyzer.tech/pt', { waitUntil: 'domcontentloaded' });
        await page.fill('#email', email);
        await page.fill('#password', password);
        await page.click('button[type="submit"]');

        // Em vez de networkidle (que pode travar por 30s devido a scripts em background),
        // esperamos que a página mude de URL ou um elemento da página de encomendas apareça
        try {
            await page.waitForURL('**/app/retail/orders**', { timeout: 15000 });
        } catch (e) {
            // Check if login failed (basic check)
            if (page.url().includes('login')) {
                 throw new Error("Falha no login. Verifique as credenciais.");
            }
        }

        // Montar a URL com os parâmetros via URLSearchParams para garantir o encoding correto
        const urlObj = new URL('https://perform.lyzer.tech/pt/app/retail/orders');
        urlObj.searchParams.append('dateSearchFor', 'deadline');

        if (targetDate) {
            // O Playwright (Node) fará o encode dos colchetes para %5B e %5D, e dois pontos para %3A
            urlObj.searchParams.append('dateRange[from]', `${targetDate}T00:00:00.000Z`);
            urlObj.searchParams.append('dateRange[to]', `${targetDate}T23:59:59.999Z`);
        }

        urlObj.searchParams.append('pageIndex', '1');
        urlObj.searchParams.append('pageSize', '50');
        urlObj.searchParams.append('sort', 'deadline:desc');

        const ordersUrl = urlObj.toString();
        console.log(`Carregando página de encomendas: ${ordersUrl}`);
        // Página principal de encomendas (garantindo os parametros e o sort)
        await page.goto(ordersUrl, { waitUntil: 'domcontentloaded' });

        const dadosRelatorio = [];

        // Captura de URLs
        // O HTML da coluna tem td com headers="column-id" que contém a tag <a> com o link completo
        const linksLocator = page.locator('td[headers="column-id"] a');

        // Timeout para não travar o servidor eternamente se a lista estiver vazia.
        let linksEncomendas = [];
        try {
            await linksLocator.first().waitFor({ state: 'attached', timeout: 15000 });
            // Extrai o texto visível (ID curto) e o href (link completo)
            linksEncomendas = await linksLocator.evaluateAll(elements =>
                elements.map(el => ({ text: el.innerText.trim(), href: el.href }))
            );
        } catch (e) {
             console.warn("Lista de encomendas vazia para o período selecionado ou página demorou a carregar.");
             // Em vez de dar erro (throw new Error), prosseguimos para retornar um array vazio [].
        }

        crawlerStatus.totalEncomendas = linksEncomendas.length;
        crawlerStatus.estado = 'Em processamento';

        for (let encomendaInfo of linksEncomendas) {
            const { text, href } = encomendaInfo;
            if (!href) continue;

            console.log(`Processando encomenda: ${text} (${href})`);

            await page.goto(href, { waitUntil: 'domcontentloaded' });

            // Espera pelo contêiner de imagem de produto para garantir que carregou
            try {
                await page.waitForSelector('div.w-full.text-center.content-center.items-center.p-2.flex.justify-center', { state: 'attached', timeout: 10000 });
            } catch (e) {
                console.warn(`Aviso: Tempo esgotado ao esperar por produtos na encomenda ${text}. Pode estar vazia ou a carregar lentamente.`);
            }

            // Extração via CSS Grid
            const produtosEncontrados = await page.evaluate(() => {
                const productImages = document.querySelectorAll('div.w-full.text-center.content-center.items-center.p-2.flex.justify-center');
                const resultados = [];

                productImages.forEach(imgDiv => {
                    const nameDiv = imgDiv.nextElementSibling;
                    const qtyDiv = nameDiv ? nameDiv.nextElementSibling : null;

                    if (nameDiv && qtyDiv) {
                        let qtyText = qtyDiv.innerText.trim() || '0';
                        if (qtyText.includes('/')) {
                            const parts = qtyText.split('/');
                            qtyText = parts[parts.length - 1].trim();
                        }

                        resultados.push({
                            nome: nameDiv.innerText.trim(),
                            quantidadeTexto: qtyText
                        });
                    }
                });
                return resultados;
            });

            let totalItens = 0;
            const listaNomes = [];

            for (const prod of produtosEncontrados) {
                const qtdNumero = parseInt(prod.quantidadeTexto, 10) || 0;
                totalItens += qtdNumero;
                listaNomes.push(`${prod.nome} (${prod.quantidadeTexto})`);
            }

            dadosRelatorio.push({
                encomenda: text, // O ID curto que aparece na tabela
                link: href,      // Link completo para rastreio
                produtosDiferentes: produtosEncontrados.length,
                quantidadeTotal: totalItens,
                listaCompleta: listaNomes.join(' | '),
                produtosDetalhes: produtosEncontrados, // Para o cálculo do Top 20
                dataCaptura: targetDate ? `${targetDate}T12:00:00.000Z` : new Date().toISOString()
            });
            crawlerStatus.encomendasLidas++;
        }

        // Append to existing file or create new
        const jsonPath = path.join(__dirname, 'dados_encomendas.json');
        let historico = [];
        if (fs.existsSync(jsonPath)) {
            try {
                const fileData = fs.readFileSync(jsonPath, 'utf-8');
                historico = JSON.parse(fileData);
            } catch (err) {
                console.error("Erro ao ler o histórico existente. Criando um novo.", err);
            }
        }

        // Adiciona novos itens, atualizando encomendas existentes se necessário
        dadosRelatorio.forEach(novaEncomenda => {
            const index = historico.findIndex(enc => enc.link === novaEncomenda.link);
            if (index !== -1) {
                historico[index] = novaEncomenda;
            } else {
                historico.push(novaEncomenda);
            }
        });

        // Save to file for caching/historical record
        fs.writeFileSync(jsonPath, JSON.stringify(historico, null, 2), 'utf-8');

        crawlerStatus.estado = 'Concluído';
        console.log('Extração concluída com sucesso!');
        res.json({ success: true, data: historico });

    } catch (error) {
        console.error('Erro durante a execução do crawler:', error);
        crawlerStatus.estado = 'Erros encontrados';
        crawlerStatus.erro = error.message || 'Erro interno no servidor';
        res.status(500).json({ success: false, error: error.message || 'Erro interno no servidor' });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

app.post('/api/corrigir-json', (req, res) => {
    const jsonPath = path.join(__dirname, 'dados_encomendas.json');
    if (!fs.existsSync(jsonPath)) {
        return res.json({ success: true, message: 'Nenhum histórico encontrado para corrigir.' });
    }

    try {
        const fileData = fs.readFileSync(jsonPath, 'utf-8');
        let historico = JSON.parse(fileData);
        let correctedCount = 0;

        // Deduplicate using link as primary key
        const deduplicatedHistorico = [];
        const seenLinks = new Set();

        // Reverse iterate to keep the latest added/updated order in case of duplicates
        for (let i = historico.length - 1; i >= 0; i--) {
            const enc = historico[i];
            if (!seenLinks.has(enc.link)) {
                seenLinks.add(enc.link);
                deduplicatedHistorico.unshift(enc); // Add to beginning to maintain original chronological order
            }
        }

        historico = deduplicatedHistorico;

        historico.forEach(encomenda => {
            let totalItens = 0;
            const listaNomes = [];

            if (encomenda.produtosDetalhes) {
                encomenda.produtosDetalhes.forEach(prod => {
                    let qtyText = prod.quantidadeTexto || '0';
                    if (qtyText.includes('/')) {
                        const parts = qtyText.split('/');
                        qtyText = parts[parts.length - 1].trim();
                        prod.quantidadeTexto = qtyText;
                        correctedCount++;
                    }

                    const qtdNumero = parseInt(prod.quantidadeTexto, 10) || 0;
                    totalItens += qtdNumero;
                    listaNomes.push(`${prod.nome} (${prod.quantidadeTexto})`);
                });

                encomenda.quantidadeTotal = totalItens;
                encomenda.listaCompleta = listaNomes.join(' | ');
            }
        });

        fs.writeFileSync(jsonPath, JSON.stringify(historico, null, 2), 'utf-8');
        res.json({ success: true, message: `JSON corrigido com sucesso! ${historico.length} encomendas mantidas após deduplicação, ${correctedCount} quantidades atualizadas.` });

    } catch (error) {
        console.error('Erro ao corrigir o JSON:', error);
        res.status(500).json({ success: false, error: 'Erro ao corrigir o JSON.' });
    }
});

app.get('/api/top-produtos', (req, res) => {
    const jsonPath = path.join(__dirname, 'dados_encomendas.json');
    if (!fs.existsSync(jsonPath)) {
        return res.json({ success: true, topUnidades: [], topPesos: [] });
    }

    try {
        const fileData = fs.readFileSync(jsonPath, 'utf-8');
        const historico = JSON.parse(fileData);
        const contagemUnidades = {};
        const contagemPesos = {};

        historico.forEach(encomenda => {
            if (encomenda.produtosDetalhes) {
                encomenda.produtosDetalhes.forEach(prod => {
                    const nome = prod.nome;
                    // Tenta extrair o número principal da string de quantidade (ex: "2/3" -> 2, "0.5/0.45 Kg" -> 0.5, "1" -> 1)
                    // Usando um regex simples para extrair o primeiro número que aparecer
                    const qtdMatch = prod.quantidadeTexto.match(/[\d.]+/);
                    const qtd = qtdMatch ? parseFloat(qtdMatch[0]) : 1;

                    const isKg = prod.quantidadeTexto.toLowerCase().includes('kg');

                    if (isKg) {
                        if (!contagemPesos[nome]) {
                            contagemPesos[nome] = 0;
                        }
                        contagemPesos[nome] += qtd;
                    } else {
                        if (!contagemUnidades[nome]) {
                            contagemUnidades[nome] = 0;
                        }
                        contagemUnidades[nome] += qtd;
                    }
                });
            }
        });

        // Converte o objeto em um array, ordena e pega o top 20 para unidades
        const topUnidades = Object.keys(contagemUnidades)
            .map(nome => ({ nome, quantidadeTotal: contagemUnidades[nome] }))
            .sort((a, b) => b.quantidadeTotal - a.quantidadeTotal)
            .slice(0, 20);

        // Converte o objeto em um array, ordena e pega o top 20 para pesos
        const topPesos = Object.keys(contagemPesos)
            .map(nome => ({ nome, quantidadeTotal: contagemPesos[nome] }))
            .sort((a, b) => b.quantidadeTotal - a.quantidadeTotal)
            .slice(0, 20);

        res.json({ success: true, topUnidades, topPesos });
    } catch (error) {
        console.error('Erro ao calcular top produtos:', error);
        res.status(500).json({ success: false, error: 'Erro ao calcular top produtos.' });
    }
});


app.get('/api/dados-dashboard', (req, res) => {
    const jsonPath = path.join(__dirname, 'dados_encomendas.json');
    if (!fs.existsSync(jsonPath)) {
        return res.json({ success: true, data: [] });
    }

    try {
        const fileData = fs.readFileSync(jsonPath, 'utf-8');
        const historico = JSON.parse(fileData);
        const dataConsolidada = [];

        historico.forEach(encomenda => {
            if (encomenda.produtosDetalhes) {
                encomenda.produtosDetalhes.forEach(prod => {
                    let qtyText = prod.quantidadeTexto || '0';
                    let isKg = qtyText.toLowerCase().includes('kg');

                    // Tratamento de quantidade 5/7 -> 7
                    if (qtyText.includes('/')) {
                        const parts = qtyText.split('/');
                        qtyText = parts[parts.length - 1].trim();
                    }

                    // Extrair apenas o número
                    const qtdMatch = qtyText.match(/[\d.]+/);
                    const qtd = qtdMatch ? parseFloat(qtdMatch[0]) : 1;

                    dataConsolidada.push({
                        encomenda: encomenda.encomenda,
                        link: encomenda.link,
                        dataCaptura: encomenda.dataCaptura || null,
                        produto: prod.nome,
                        quantidade: qtd,
                        unidade: isKg ? 'kg' : 'unidade',
                        origem: 'Lyzer'
                    });
                });
            }
        });

        res.json({ success: true, data: dataConsolidada });
    } catch (error) {
        console.error('Erro ao processar dados para o dashboard:', error);
        res.status(500).json({ success: false, error: 'Erro interno ao processar os dados' });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
