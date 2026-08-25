# DIRETRIZES MOBILE-FIRST — PORTAL DO MILITAR

O **Portal do Militar** foi projetado com prioridade máxima para dispositivos móveis (smartphones), considerando o perfil de uso dos militares em campo e no dia a dia.

---

## 1. Princípios de Design e Usabilidade Mobile

1. **Ambientes Primários:**
   - Google Chrome no Android
   - Safari no iOS (iPhone)
   - Desktop é considerado ambiente secundário.

2. **Faixas de Resolução (Viewports de Teste):**
   - 360 px (Android padrão/compacto)
   - 375 px (iPhone SE / padrão histórico)
   - 390 / 393 px (iPhone 13, 14, 15, 16)
   - 412 / 430 px (Android telas grandes / iPhone Pro Max)
   - $\ge$ 1024 px (Desktop adaptável)

3. **Áreas de Toque e Interação:**
   - Botões com altura mínima de 48px e área de toque ampla.
   - Zero dependência de eventos hover (indisponíveis em telas touch).
   - Teclados adequados: inputMode="numeric" para CPF e códigos OTP (pattern="[0-9]*", utoComplete="one-time-code").
   - Espaçamento confortável entre elementos tocáveis para evitar toques acidentais.

4. **Layout e Responsividade:**
   - Estrutura vertical em coluna única.
   - Sem tabelas de rolagem horizontal complexas (usar cards empilhados no mobile).
   - Modais full-screen ou bottom sheets em telas pequenas.
   - Feedback visual imediato de carregamento e estados de erro legíveis.
