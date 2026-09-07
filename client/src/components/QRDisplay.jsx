import { QRCodeSVG } from "qrcode.react";

export default function QRDisplay({ url, size = 240 }) {
  return (
    <div className="host-idle-qr">
      <QRCodeSVG value={url} size={size} level="M" />
    </div>
  );
}
