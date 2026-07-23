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
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
    }

    console.log(`Iniciando crawler para o usuário: ${email}`);

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();

        // Login
        await page.goto('https://perform.lyzer.tech/pt');
        await page.fill('#email', email);
        await page.fill('#password', password);
        await page.click('button[type="submit"]');

        // Wait for login to complete (adjust if there's a better specific element to wait for)
        await page.waitForLoadState('networkidle');

        // Check if login failed (basic check - could be improved based on actual site behavior)
        const url = page.url();
        if (url.includes('login')) {
             throw new Error("Falha no login. Verifique as credenciais.");
        }


        // Página principal de encomendas
        await page.goto('https://perform.lyzer.tech/pt/app/retail/orders?dateSearchFor=deadline&pageIndex=1&pageSize=50');
        await page.waitForLoadState('networkidle');

        const dadosRelatorio = [];

        // Captura de IDs
        // O HTML da coluna tem td com headers="column-id" que contém a tag <a> com o ID
        const linksLocator = page.locator('td[headers="column-id"] a');

        // Timeout para não travar o servidor eternamente se a lista estiver vazia.
        let idsEncomendas = [];
        try {
            await linksLocator.first().waitFor({ state: 'attached', timeout: 15000 });
            idsEncomendas = await linksLocator.allInnerTexts();
        } catch (e) {
             console.warn("Lista de encomendas vazia ou seletor não encontrado.");
             throw new Error("Nenhuma encomenda encontrada na lista ou página demorou a carregar.");
        }


        for (let orderId of idsEncomendas) {
            orderId = orderId.trim();
            if (!orderId) continue;

            console.log(`Processando encomenda: ${orderId}`);

            const urlEncomenda = `https://perform.lyzer.tech/pt/track/${orderId}`;
            await page.goto(urlEncomenda);
            await page.waitForLoadState('networkidle');

            // Extração via CSS Grid
            const produtosEncontrados = await page.evaluate(() => {
                const grid = document.querySelector('.grid.grid-cols-\\[auto\\,1fr\\,auto\\,auto\\]');
                if (!grid) return [];

                const nodesNomes = grid.querySelectorAll('div.w-full.content-center:not(.col-span-2) > span.typography-p-ui');
                const nodesQuantidades = grid.querySelectorAll('div.w-full.text-center.content-center > div > span.typography-p-ui');

                const resultados = [];
                for (let i = 0; i < nodesNomes.length; i++) {
                    resultados.push({
                        nome: nodesNomes[i].innerText.trim(),
                        quantidadeTexto: nodesQuantidades[i] ? nodesQuantidades[i].innerText.trim() : '0'
                    });
                }
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
                encomenda: orderId,
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
