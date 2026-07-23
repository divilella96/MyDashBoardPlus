const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    console.log('Iniciando o crawler...');

    try {
        // Login
        await page.goto('https://perform.lyzer.tech/pt');

        // Preenchendo o email, senha e clicando no botão de entrar (seletores identificados)
        await page.fill('#email', 'seu_email');
        await page.fill('#password', 'sua_senha');
        await page.click('button[type="submit"]');
        await page.waitForLoadState('networkidle');

        // Página principal
        await page.goto('https://perform.lyzer.tech/pt/app/retail/orders?dateSearchFor=deadline&pageIndex=1&pageSize=50');
        await page.waitForLoadState('networkidle');

        const dadosRelatorio = [];

        // Captura de IDs
        // O HTML da coluna tem td com headers="column-id" que contém a tag <a> com o ID
        const linksLocator = page.locator('td[headers="column-id"] a');
        const idsEncomendas = await linksLocator.allInnerTexts();

        for (let orderId of idsEncomendas) {
            orderId = orderId.trim();
            if (!orderId) continue;

            console.log(`Processando encomenda: ${orderId}`);

            const urlEncomenda = `https://perform.lyzer.tech/pt/track/${orderId}`;
            await page.goto(urlEncomenda);
            await page.waitForLoadState('networkidle');

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
                encomenda: orderId,
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
