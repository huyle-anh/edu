import QRCode from "qrcode";

// NAPAS BIN theo mã/tên viết tắt ngân hàng thường dùng (danh sách của VietQR).
const VIETQR_BANK_BINS: Record<string, string> = {
  VCB: "970436", VIETCOMBANK: "970436",
  BIDV: "970418",
  ICB: "970415", CTG: "970415", VIETINBANK: "970415",
  VBA: "970405", AGRIBANK: "970405",
  TCB: "970407", TECHCOMBANK: "970407",
  MB: "970422", MBB: "970422", MBBANK: "970422",
  ACB: "970416",
  VPB: "970432", VPBANK: "970432",
  TPB: "970423", TPBANK: "970423",
  STB: "970403", SACOMBANK: "970403",
  HDB: "970437", HDBANK: "970437",
  VIB: "970441",
  SHB: "970443",
  EIB: "970431", EXIMBANK: "970431",
  MSB: "970426",
  OCB: "970448",
  SCB: "970429",
  SEAB: "970440", SEABANK: "970440",
  LPB: "970449", LPBANK: "970449",
  NAB: "970428", NAMABANK: "970428",
  ABB: "970425", ABBANK: "970425",
  BAB: "970409", BACABANK: "970409",
  VCCB: "970454", BVB: "970454",
  PGB: "970430", PGBANK: "970430",
  SGICB: "970400", SAIGONBANK: "970400",
  KLB: "970452", KIENLONGBANK: "970452",
  VAB: "970427", VIETABANK: "970427",
  NCB: "970419",
  PVCB: "970412", PVCOMBANK: "970412",
  GPB: "970408", GPBANK: "970408",
  VIETBANK: "970433",
  OCEANBANK: "970414",
  COOPBANK: "970446",
  CBB: "970444", CBBANK: "970444",
  IVB: "970434", INDOVINABANK: "970434",
  VRB: "970421",
  SHBVN: "970424", SHINHAN: "970424", SHINHANBANK: "970424",
  WVN: "970457", WOORI: "970457", WOORIBANK: "970457",
  UOB: "970458",
  HLBVN: "970442", HONGLEONG: "970442",
  PBVN: "970439", PUBLICBANK: "970439",
  SCVN: "970410", STANDARDCHARTERED: "970410",
  CIMB: "422589",
  HSBC: "458761",
  DBS: "796500",
  KBANK: "668888", KASIKORNBANK: "668888",
  CAKE: "546034",
  UBANK: "546035",
  TIMO: "963388",
};

export function getVietQrBankBin(bankCode: string) {
  const normalized = bankCode.trim().toUpperCase().replace(/[\s_-]+/g, "");
  if (/^\d{6}$/.test(normalized)) return normalized;
  return VIETQR_BANK_BINS[normalized] ?? null;
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

function crc16Ccitt(input: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(input, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildVietQrPayload({ bankBin, accountNo, amount, addInfo }: { bankBin: string; accountNo: string; amount: number; addInfo: string }) {
  const merchantAccount = tlv("00", "A000000727") + tlv("01", tlv("00", bankBin) + tlv("01", accountNo.trim())) + tlv("02", "QRIBFTTA");
  const content = addInfo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\x20-\x7E]/g, "").slice(0, 25);
  const body = [
    tlv("00", "01"),
    tlv("01", "12"),
    tlv("38", merchantAccount),
    tlv("53", "704"),
    tlv("54", String(Math.round(amount))),
    tlv("58", "VN"),
    tlv("62", tlv("08", content)),
  ].join("") + "6304";
  return body + crc16Ccitt(body);
}

type VietQrInput = { bankCode: string; accountNo: string; amount: number; addInfo: string };

export function unsupportedVietQrBankMessage(bankCode: string) {
  return `Mã ngân hàng "${bankCode}" chưa hỗ trợ tạo QR. Hãy dùng mã viết tắt (VCB, BIDV, TCB, MB…) hoặc mã BIN 6 số của ngân hàng`;
}

// Single QR source for both notice PDFs and the payment screen; no external image service.
export async function buildVietQrPng({ bankCode, accountNo, amount, addInfo }: VietQrInput) {
  const bankBin = getVietQrBankBin(bankCode);
  if (!bankBin) return null;
  return QRCode.toBuffer(buildVietQrPayload({ bankBin, accountNo, amount, addInfo }), { type: "png", errorCorrectionLevel: "M", margin: 1, width: 600 });
}

export async function buildVietQrDataUrl(input: VietQrInput) {
  const png = await buildVietQrPng(input);
  return png ? `data:image/png;base64,${png.toString("base64")}` : null;
}
