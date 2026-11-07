"use client";

import { Box, Divider, Stack, Typography } from "@mui/material";

export type VietQrCardData = {
  qrDataUrl: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  accountNo: string;
  amount: number;
  batchNo: string;
  transferContent: string;
};

// The card mirrors a printed VietQR slip, so it stays light in both themes.
const CARD_INK = "#1b2b4a";
const CARD_MUTED = "#5b6b82";
const CARD_ACCENT = "#1d3f8f";
const CARD_RED = "#c62828";

const formatAmount = (value: number) => `${new Intl.NumberFormat("vi-VN").format(value)} VND`;

export function VietQrCard({ data }: { data: VietQrCardData }) {
  return (
    <Box sx={{ width: "100%", maxWidth: 360, bgcolor: "#fff", color: CARD_INK, border: "1px solid #d5dce6", borderRadius: 2, px: 2.5, py: 2, textAlign: "center" }}>
      <Box sx={{ mx: "auto", width: "fit-content", p: 0.75, border: `2px solid ${CARD_ACCENT}`, borderRadius: 1 }}>
        <Box component="img" src={data.qrDataUrl} alt={`QR chuyển khoản đợt ${data.batchNo}`} sx={{ display: "block", width: 240, height: 240, maxWidth: "100%" }} />
      </Box>
      <Stack direction="row" justifyContent="center" alignItems="center" spacing={1.25} sx={{ mt: 1.5 }}>
        <Typography sx={{ fontWeight: 800, fontStyle: "italic", color: CARD_ACCENT }}>napas 247</Typography>
        <Divider orientation="vertical" flexItem sx={{ borderColor: CARD_ACCENT }} />
        <Typography sx={{ fontWeight: 900, color: CARD_ACCENT }}>{data.bankCode.toUpperCase()}</Typography>
      </Stack>
      <Typography sx={{ mt: 1.25, fontWeight: 800, fontSize: 15, textTransform: "uppercase", overflowWrap: "anywhere" }}>{data.accountName}</Typography>
      <Typography sx={{ fontSize: 14, color: CARD_MUTED }}>{data.accountNo}</Typography>
      <Typography sx={{ mt: 0.5, fontSize: 14 }}>
        Số tiền: <Box component="strong" sx={{ color: CARD_RED }}>{formatAmount(data.amount)}</Box>
      </Typography>
      <Typography sx={{ fontSize: 13, color: CARD_MUTED, overflowWrap: "anywhere" }}>Nội dung: {data.transferContent}</Typography>
    </Box>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không thể tải ảnh QR"));
    image.src = src;
  });
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && context.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
}

// Renders the same card layout to a PNG so the downloaded file matches what is on screen.
export async function downloadVietQrCard(data: VietQrCardData) {
  const width = 600;
  const height = 736;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ tạo ảnh QR");
  const font = (weight: number, size: number, style = "") => `${style} ${weight} ${size}px Arial, "Helvetica Neue", sans-serif`.trim();
  const center = width / 2;

  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#d5dce6";
  context.lineWidth = 2;
  context.strokeRect(1, 1, width - 2, height - 2);

  context.textBaseline = "alphabetic";

  const qrSize = 400;
  const qrX = center - qrSize / 2;
  const qrY = 48;
  context.lineWidth = 4;
  context.strokeStyle = CARD_ACCENT;
  context.strokeRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);
  context.drawImage(await loadImage(data.qrDataUrl), qrX, qrY, qrSize, qrSize);

  context.textAlign = "center";
  const rowY = qrY + qrSize + 66;
  context.font = font(800, 28, "italic");
  const napasText = "napas 247";
  const napasWidth = context.measureText(napasText).width;
  context.font = font(900, 28);
  const bankText = data.bankCode.toUpperCase();
  const bankWidth = context.measureText(bankText).width;
  const gap = 24;
  const rowStart = center - (napasWidth + gap * 2 + bankWidth) / 2;
  context.textAlign = "left";
  context.fillStyle = CARD_ACCENT;
  context.font = font(800, 28, "italic");
  context.fillText(napasText, rowStart, rowY);
  context.fillRect(rowStart + napasWidth + gap - 1, rowY - 28, 2, 36);
  context.font = font(900, 28);
  context.fillText(bankText, rowStart + napasWidth + gap * 2, rowY);

  context.textAlign = "center";
  context.fillStyle = CARD_INK;
  context.font = font(800, 30);
  context.fillText(fitText(context, data.accountName.toUpperCase(), width - 60), center, rowY + 60);
  context.fillStyle = CARD_MUTED;
  context.font = font(400, 28);
  context.fillText(data.accountNo, center, rowY + 100);
  context.fillStyle = CARD_INK;
  context.font = font(400, 28);
  const amountLabel = "Số tiền: ";
  const amountText = formatAmount(data.amount);
  const labelWidth = context.measureText(amountLabel).width;
  context.font = font(800, 28);
  const amountWidth = context.measureText(amountText).width;
  const amountStart = center - (labelWidth + amountWidth) / 2;
  context.textAlign = "left";
  context.font = font(400, 28);
  context.fillText(amountLabel, amountStart, rowY + 144);
  context.fillStyle = CARD_RED;
  context.font = font(800, 28);
  context.fillText(amountText, amountStart + labelWidth, rowY + 144);
  context.textAlign = "center";
  context.fillStyle = CARD_MUTED;
  context.font = font(400, 24);
  context.fillText(fitText(context, `Nội dung: ${data.transferContent}`, width - 60), center, rowY + 186);

  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `qr-${data.batchNo}.png`;
  link.click();
}
