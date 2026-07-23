const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.post('/api/crawler', async (req, res) => {
    const { email, password, dateFrom, dateTo } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

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

        if (dateFrom) {
            // O Playwright (Node) fará o encode dos colchetes para %5B e %5D, e dois pontos para %3A
            urlObj.searchParams.append('dateRange[from]', `${dateFrom}T00:00:00.000Z`);
        }
        if (dateTo) {
            urlObj.searchParams.append('dateRange[to]', `${dateTo}T23:59:59.999Z`);
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
                        resultados.push({
                            nome: nameDiv.innerText.trim(),
                            quantidadeTexto: qtyDiv.innerText.trim() || '0'
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
                listaCompleta: listaNomes.join(' | ')
            });
        }

        // Save to file for caching/historical record
        fs.writeFileSync(path.join(__dirname, 'dados_encomendas.json'), JSON.stringify(dadosRelatorio, null, 2), 'utf-8');

        console.log('Extração concluída com sucesso!');
        res.json({ success: true, data: dadosRelatorio });

    } catch (error) {
        console.error('Erro durante a execução do crawler:', error);
        res.status(500).json({ success: false, error: error.message || 'Erro interno no servidor' });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
