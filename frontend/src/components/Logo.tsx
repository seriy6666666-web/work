export function Logo({ height = 32 }: { height?: number }) {
  return (
    <img
      src="/belmy-logo.png"
      alt="BELMY ENERGY"
      style={{ height, width: 'auto', display: 'block', alignSelf: 'flex-start', flexShrink: 0 }}
    />
  );
}
