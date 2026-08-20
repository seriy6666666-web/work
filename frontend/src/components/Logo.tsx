import { useRef } from 'react';
import { LOGO_SVG } from './belmy-marks';

/**
 * Логотип в шапке: знак вектором плюс надпись.
 *
 * По знаку проходит блик при наведении и вжатие при нажатии — вжатие работает и
 * на планшете, где наведения нет вовсе.
 *
 * `dark` берёт светлую надпись: в тёмном меню чёрная не читается. Раньше логотип
 * там выводился фильтром «в белое», из-за чего зелёный лист становился серым.
 */
export function Logo({ height = 32, dark = false }: { height?: number; dark?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);

  // Блик запускается на каждый вход курсора: класс снимаем по концу анимации,
  // иначе повторное наведение ничего не покажет.
  function blik() {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('is-blik');
    // Перечитываем размер, чтобы браузер заметил снятие класса и запустил заново.
    void el.offsetWidth;
    el.classList.add('is-blik');
  }

  return (
    <button
      ref={ref}
      className="belmy-logo"
      type="button"
      aria-label="BELMY ENERGY"
      style={{ ['--belmy-logo-h' as string]: `${height}px` }}
      onMouseEnter={blik}
      onAnimationEnd={() => ref.current?.classList.remove('is-blik')}
    >
      <span dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />
      <img src={dark ? '/belmy-wordmark-dark.png' : '/belmy-wordmark.png'} alt="" />
    </button>
  );
}
