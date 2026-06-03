import dgram from "node:dgram";

/** Нормализация MAC: AA:BB:CC:DD:EE:FF → aabbccddeeff */
export function normalizeMac(mac: string): string {
  return mac.replace(/[^a-fA-F0-9]/g, "").toLowerCase();
}

export function macToBuffer(mac: string): Buffer {
  const hex = normalizeMac(mac);
  if (hex.length !== 12) {
    throw new Error(`Некорректный MAC: ${mac}`);
  }
  return Buffer.from(hex, "hex");
}

/** Magic packet Wake-on-LAN (UDP 9) */
export function buildMagicPacket(mac: string): Buffer {
  const macBuf = macToBuffer(mac);
  const prefix = Buffer.alloc(6, 0xff);
  const repeated = Buffer.alloc(16 * 6);
  for (let i = 0; i < 16; i++) {
    macBuf.copy(repeated, i * 6);
  }
  return Buffer.concat([prefix, repeated]);
}

export function sendWakeOnLan(
  mac: string,
  broadcast = "255.255.255.255",
  port = 9
): Promise<void> {
  const packet = buildMagicPacket(mac);
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    socket.once("error", reject);
    socket.bind(() => {
      socket.setBroadcast(true);
      socket.send(packet, 0, packet.length, port, broadcast, (err) => {
        socket.close();
        if (err) reject(err);
        else resolve();
      });
    });
  });
}
