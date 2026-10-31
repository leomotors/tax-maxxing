# Tax-Maxxing

เครื่องมือช่วย**ลดภาษี**บุคคลธรรมดาสำหรับคนไทย (static Next.js)

ข้อมูลเก็บในเบราว์เซอร์ผ่าน `localStorage` และสำรองด้วยไฟล์ JSON หรือ Google Drive ของผู้ใช้เอง — ไม่มีเซิร์ฟเวอร์

## Features

- กรอกเงินได้พึงประเมิน มาตรา 40(1), 40(2), 40(4) หลายแหล่งต่อประเภท
- 40(4) เลือกภาษีสุดท้าย / รวมคำนวณ / อัตโนมัติ (ระบบแนะนำให้)
- ค่าลดหย่อนส่วนตัว ประกัน RMF ThaiESG บริจาค
- แนะนำวงเงินลงทุน/บริจาคเพิ่มว่าจะลดภาษีได้เท่าไร
- ตารางสรุปใกล้เคียง ภ.ง.ด.90/91

## Development

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
```

Dev server: [http://localhost:3000](http://localhost:3000)

Build เป็น static export ที่โฟลเดอร์ `out/`

## Google Drive backup

สำรองทุกรายการเป็นไฟล์เดียว `tax-maxxing-backup.json` ใน My Drive ของผู้ใช้ (OAuth ฝั่ง browser ผ่าน Google Identity Services, scope `drive.file` — แอปเห็นเฉพาะไฟล์ที่แอปสร้างเอง)

1. Google Cloud Console → เปิด Google Drive API
2. OAuth consent screen + เพิ่ม scope `https://www.googleapis.com/auth/drive.file`
3. สร้าง OAuth Client ID ชนิด Web application → Authorized JavaScript origins: `http://localhost:3000` และ origin ที่ deploy
4. คัดลอก `.env.example` เป็น `.env.local` แล้วตั้งค่า `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (หรือ env ตอน build) — ถ้าไม่ตั้ง ปุ่ม Google Drive จะถูกซ่อน

> แอปนี้ไม่ได้ส่งให้ Google ตรวจสอบ (OAuth consent screen อยู่ในโหมด Testing) — ใช้ได้เฉพาะบัญชีที่เพิ่มเป็น test user เท่านั้น ผู้ใช้อื่นจะเจอ "Access blocked" หากต้องการใช้เอง ให้ deploy พร้อม Client ID ของตัวเอง

ข้อจำกัด: ไฟล์ที่อัปโหลดเองผ่านหน้าเว็บ Drive แอปมองไม่เห็น ให้กู้คืนผ่าน "โหลด JSON" แทน · การตรวจชนกันเป็นแบบตรวจก่อนเขียน (ไม่ atomic) · หลายแท็บพร้อมกันเป็น last-writer-wins

## Release

ใช้รูปแบบ changelog แบบ portfolio-tracking:

- รายการใหม่ใส่ใต้ `## [minor]` (หรือ `[patch]` / `[major]`) ใน `CHANGELOG.md`
- เมื่อ release ให้เลื่อนรายการไปเป็น `## [x.y.z] - YYYY-MM-DD` และอัปเดต `version` ใน `package.json`

## Notes

- ปีภาษีเริ่มต้น: 2569
- 40(3), 40(5)–40(8) ยังเป็น placeholder
- นำเข้าเงินปันผลไทยจาก `.xlsx` ยังเป็น placeholder บน UI
- เป็นประมาณการ ไม่ใช่คำปรึกษาทางภาษี
