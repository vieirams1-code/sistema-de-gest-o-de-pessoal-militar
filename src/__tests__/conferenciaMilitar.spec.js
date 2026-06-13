import { test, expect } from '@playwright/test';

test.describe('Módulo Conferência Cadastral de Militar', () => {
  test.beforeEach(async ({ page }) => {
    // Em um ambiente real, faríamos login aqui.
    // Para homologação local, assumimos que o servidor está rodando.
    await page.goto('/ConferenciasMilitares');
  });

  test('deve exibir o menu e carregar a página corretamente', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Conferência Cadastral de Militar' })).toBeVisible();
    await expect(page.getByText('Controle de saneamento cadastral')).toBeVisible();
  });

  test('deve permitir criar uma nova conferência de ingresso', async ({ page }) => {
    const btnNova = page.getByRole('button', { name: 'Nova Conferência' });
    await expect(btnNova).toBeVisible();
    await btnNova.click();

    await expect(page.getByText('Nova Conferência Cadastral')).toBeVisible();

    // Simula seleção de militar (via GlobalMilitarSearch)
    // Nota: Locators dependem da implementação do componente de busca
    const searchInput = page.getByPlaceholder('Buscar militar por nome ou matrícula...');
    await searchInput.fill('João Silva');
    // Assume que o primeiro resultado aparece e é clicável
    await page.locator('div[role="option"]').first().click();

    await page.getByLabel('Tipo de Conferência').selectOption('ingresso');
    await page.getByRole('button', { name: 'Criar Conferência' }).click();

    // Verifica se abriu o drawer de detalhes
    await expect(page.getByText('Checklist de Conferência')).toBeVisible();
    // Verifica se gerou 10 itens (ingresso)
    const rows = page.locator('table >> tr.group');
    await expect(rows).toHaveCount(10);
  });

  test('deve validar regras de conclusão com itens pendentes', async ({ page }) => {
    // Abre a primeira conferência da lista
    await page.getByRole('button', { name: 'Abrir' }).first().click();

    // Tenta concluir sem mexer em nada (todos pendentes)
    const btnConcluir = page.getByRole('button', { name: 'Concluir Conferência' });
    await btnConcluir.click();

    // Deve exibir mensagem de erro (toast)
    await expect(page.getByText(/existem \d+ itens obrigatórios pendentes/)).toBeVisible();
  });

  test('deve concluir conferência com sucesso após marcar todos os itens', async ({ page }) => {
    await page.getByRole('button', { name: 'Abrir' }).first().click();

    // Marca todos os itens como 'Conferido'
    const selects = page.locator('select');
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      await selects.nth(i).selectOption('conferido');
    }

    // Verifica se o progresso chegou a 100%
    await expect(page.getByText('100%')).toBeVisible();

    // Conclui
    await page.getByRole('button', { name: 'Concluir Conferência' }).click();

    // Verifica status final
    await expect(page.getByText('Concluída', { exact: true })).toBeVisible();
  });

  test('deve permitir copiar missão para Trello', async ({ page }) => {
    await page.getByRole('button', { name: 'Abrir' }).first().click();
    const btnCopiar = page.getByRole('button', { name: 'Copiar missão para Trello' });
    await expect(btnCopiar).toBeVisible();

    // O clique aciona navigator.clipboard.writeText
    await btnCopiar.click();
    await expect(page.getByText('Texto da missão copiado')).toBeVisible();
  });
});
