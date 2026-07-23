const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    console.log('Iniciando o crawler...');

    try {
        // Login
        await page.goto('https://perform.lyzer.tech/pt', { waitUntil: 'domcontentloaded' });

        // Preenchendo o email, senha e clicando no botão de entrar (seletores identificados)
        await page.fill('#email', 'seu_email');
        await page.fill('#password', 'sua_senha');
        await page.click('button[type="submit"]');

        try {
            await page.waitForURL('**/app/retail/orders**', { timeout: 15000 });
        } catch (e) {
            console.warn("Demora no login, prosseguindo...");
        }

        // Página principal
        await page.goto('https://perform.lyzer.tech/pt/app/retail/orders?dateSearchFor=deadline&pageIndex=1&pageSize=50', { waitUntil: 'domcontentloaded' });

        const dadosRelatorio = [];

        // Captura de URLs
        // O HTML da coluna tem td com headers="column-id" que contém a tag <a> com o ID e href completos
        const linksLocator = page.locator('td[headers="column-id"] a');

        // Extrai o texto visível e o href do DOM
        const linksEncomendas = await linksLocator.evaluateAll(elements =>
            elements.map(el => ({ text: el.innerText.trim(), href: el.href }))
        );

        for (let encomendaInfo of linksEncomendas) {
            const { text, href } = encomendaInfo;
            if (!href) continue;

            console.log(`Processando encomenda: ${text} (${href})`);

            await page.goto(href, { waitUntil: 'domcontentloaded' });

            try {
                await page.waitForSelector('div.w-full.text-center.content-center.items-center.p-2.flex.justify-center', { state: 'attached', timeout: 10000 });
            } catch (e) {
                console.warn(`Aviso: Tempo esgotado ao esperar por produtos na encomenda ${text}.`);
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
                encomenda: text,
                link: href,
                produtosDiferentes: produtosEncontrados.length,
                quantidadeTotal: totalItens,
                listaCompleta: listaNomes.join(' | ')
            });
        }

        fs.writeFileSync('dados_encomendas.json', JSON.stringify(dadosRelatorio, null, 2), 'utf-8');
        console.log('Extração concluída com sucesso!');

    } catch (error) {
        console.error('Erro durante a execução:', error);
    } finally {
        await browser.close();
    }
})();
