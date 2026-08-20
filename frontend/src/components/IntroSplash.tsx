import { useEffect, useState, type ReactNode } from 'react';
import { START_SVG } from './belmy-marks';

const SESSION_KEY = 'belmy_intro_shown';

/**
 * Заставка при входе.
 *
 * Собирается из знака BELMY: узлы всплывают снизу вверх, протягиваются связи,
 * по ним проходит волна свечения, вырастает лист, проявляется надпись. Всё
 * длится 2,55 с и показывается один раз за сеанс — раньше здесь крутилось
 * видео на несколько мегабайт.
 *
 * Клик пропускает: на планшете в цеху ждать две с половиной секунды каждый раз,
 * когда браузер перезапустили, никто не станет.
 */
const DURATION_MS = 2550;
/** Столько идёт растворение по CSS — снимаем заставку не раньше. */
const FADE_MS = 450;

export function IntroSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(() => !sessionStorage.getItem(SESSION_KEY));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setDone(true), DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!done) return;
    sessionStorage.setItem(SESSION_KEY, '1');
    const timer = window.setTimeout(() => setVisible(false), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [done]);

  if (!visible) return <>{children}</>;

  return (
    <>
      <div
        className={`belmy-start${done ? ' is-done' : ''}`}
        onClick={() => setDone(true)}
        role="presentation"
      >
        <div className="belmy-start__mark" dangerouslySetInnerHTML={{ __html: START_SVG }} />
        {/*
          Надпись растром из фирменных материалов: своей версии в векторе нет.
          Тёмная заставка — значит светлый вариант.
        */}
        <img className="belmy-start__word" src="/belmy-wordmark-dark.png" alt="BELMY ENERGY" />
      </div>
      <div style={{ visibility: 'hidden' }}>{children}</div>
    </>
  );
}
