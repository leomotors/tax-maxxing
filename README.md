# Tax-Maxxing

เครื่องมือช่วย**ลดภาษี**บุคคลธรรมดาสำหรับคนไทย (static Next.js)

ข้อมูลเก็บในเบราว์เซอร์ผ่าน `localStorage` และสำรองด้วยไฟล์ JSON — ไม่มีเซิร์ฟเวอร์

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

## Release

ใช้รูปแบบ changelog แบบ portfolio-tracking:

- รายการใหม่ใส่ใต้ `## [minor]` (หรือ `[patch]` / `[major]`) ใน `CHANGELOG.md`
- เมื่อ release ให้เลื่อนรายการไปเป็น `## [x.y.z] - YYYY-MM-DD` และอัปเดต `version` ใน `package.json`

## Notes

- ปีภาษีเริ่มต้น: 2569
- 40(3), 40(5)–40(8) ยังเป็น placeholder
- นำเข้าเงินปันผลไทยจาก `.xlsx` ยังเป็น placeholder บน UI
- เป็นประมาณการ ไม่ใช่คำปรึกษาทางภาษี
