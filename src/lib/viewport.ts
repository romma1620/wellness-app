/**
 * Нижче цього порога різницю висот вважаємо шумом, а не клавіатурою: iOS
 * повертає розбіжність у кілька пікселів під час інерційного скролу, і без
 * порога панель сіпалась би на кожній події. Жодна клавіатура не буває
 * нижчою за це значення.
 */
const NOISE_PX = 24;

/**
 * Скільки пікселів знизу layout-вьюпорта перекрито екранною клавіатурою.
 *
 * iOS не стискає layout-вьюпорт, коли зʼявляється клавіатура — змінюється
 * лише visual viewport. Через це `position: fixed` і `vh` далі міряються від
 * повної висоти екрана, і все, що притиснуте до низу, опиняється під
 * клавіатурою. Ця різниця і є висота, на яку треба підняти вміст.
 *
 * `visualOffsetTop` враховує випадок, коли iOS зсунув layout усередині
 * visual viewport, щоб показати сфокусоване поле: такий зсув уже компенсує
 * частину перекриття.
 */
export function keyboardInset(
  layoutHeight: number,
  visualHeight: number,
  visualOffsetTop: number,
): number {
  const covered = Math.round(layoutHeight - visualHeight - visualOffsetTop);
  return covered >= NOISE_PX ? covered : 0;
}
