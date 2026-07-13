import { useState, type ReactNode } from 'react';

const SESSION_KEY = 'belmy_intro_shown';

export function IntroSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(() => !sessionStorage.getItem(SESSION_KEY));
  const [fading, setFading] = useState(false);

  function finish() {
    if (fading) return;
    sessionStorage.setItem(SESSION_KEY, '1');
    setFading(true);
    setTimeout(() => setVisible(false), 400);
  }

  if (!visible) return <>{children}</>;

  return (
    <>
      <div style={{ ...styles.overlay, opacity: fading ? 0 : 1 }} onClick={finish}>
        <video
          src="/belmy-intro.mp4"
          autoPlay
          muted
          playsInline
          onEnded={finish}
          style={styles.video}
        />
        <p style={styles.hint}>Нажмите, чтобы пропустить</p>
      </div>
      <div style={{ visibility: 'hidden' }}>{children}</div>
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: '#e5e5e5',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'opacity 0.4s ease',
  },
  video: {
    maxWidth: '100%',
    maxHeight: '80vh',
  },
  hint: {
    marginTop: '16px',
    color: '#8fa8b0',
    fontSize: '13px',
  },
};
