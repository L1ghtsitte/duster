const ICONS: Record<string, string> = {
  player: "player",
  admin: "admin",
  computer: "pc",
  pc: "pc",
  vip: "vip-pc",
  product: "product",
  package: "package",
  shift: "shift",
  pos: "pos",
  telegram: "telegram",
  referral: "referral",
  giveaway: "giveaway",
  loyalty: "loyalty",
  anticheat: "shield",
  qr: "qr",
  calendar: "calendar",
  excel: "excel",
  webrtc: "webrtc",
  gamehub: "gamepad",
  reservation: "reserved",
  reserved: "reserved",
  offline: "offline",
  free: "pc-free",
  busy: "pc-busy",
  maintenance: "maintenance",
  server: "server",
  club: "club",
  network: "network",
  redis: "redis",
  docker: "docker",
  postgres: "postgres",
  nginx: "nginx",
  "2fa": "lock-2fa",
  pwa: "pwa",
  tariff: "tariff",
  analytics: "analytics",
  heatmap: "heatmap",
  inventory: "inventory",
  usb: "usb",
  cpu: "cpu",
  gpu: "gpu",
  ram: "ram",
  temperature: "temperature",
  steam: "steam",
  epic: "epic",
  riot: "riot",
  payment: "payment",
  cash: "cash",
  card: "card",
  webhook: "webhook",
  notification: "notification",
  session: "session",
  sale: "sale",
  announcement: "announcement",
  "audit-log": "audit-log",
  drink: "drink",
  snack: "snack",
  "zone-vip": "zone-vip",
  "zone-standard": "zone-standard",
  "badge-night": "badge-night",
  "badge-whale": "badge-whale",
  "badge-loyal": "badge-loyal",
};

export function EntityIcon({
  kind,
  size = 24,
  className,
}: {
  kind: string;
  size?: number;
  className?: string;
}) {
  const file = ICONS[kind] ?? kind;
  return (
    <img
      src={`/models/${file}.svg`}
      width={size}
      height={size}
      alt=""
      className={className}
      style={{ verticalAlign: "middle", objectFit: "contain" }}
      onError={(e) => {
        (e.target as HTMLImageElement).src = "/models/pc.svg";
      }}
    />
  );
}
