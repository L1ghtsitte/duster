export function pcModelSrc(zone: string, status: string, mapStatus?: string): string {
  const s = mapStatus ?? status;
  if (s === "offline" || status === "offline") return "/models/offline.svg";
  if (s === "reserved" || status === "reserved") return "/models/reserved.svg";
  if (s === "busy" || status === "in_use") return "/models/pc-busy.svg";
  if (status === "maintenance") return "/models/pc-maintenance.svg";
  if (s === "free" || status === "online" || status === "locked") return "/models/pc-free.svg";
  if (zone === "vip") return "/models/vip-pc.svg";
  if (zone === "ps5" || zone === "console") return "/models/zone-ps5.svg";
  if (zone === "cockpit") return "/models/zone-cockpit.svg";
  return "/models/pc.svg";
}

export function PcIcon({
  zone,
  status,
  mapStatus,
  size = 48,
}: {
  zone: string;
  status: string;
  mapStatus?: string;
  size?: number;
}) {
  return (
    <img
      src={pcModelSrc(zone, status, mapStatus)}
      alt=""
      width={size}
      height={size}
      style={{ display: "block", margin: "0 auto 4px" }}
    />
  );
}
