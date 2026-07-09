import os
import time
from google import genai
from google.genai import errors

# 1. ตั้งค่า API Key ผ่าน env var ก่อนรัน:  set GOOGLE_API_KEY=...
#    (อย่าฝัง key ในไฟล์ — ไฟล์นี้ถูก push ขึ้น GitHub)
GOOGLE_API_KEY = os.environ["GOOGLE_API_KEY"]

# 2. ประกาศ Client เชื่อมต่อระบบ (รูปแบบใหม่)
client = genai.Client(api_key=GOOGLE_API_KEY)

def generate_content_with_retry(prompt, max_retries=5):
    """ฟังก์ชันส่งคำสั่งหา Gemini ด้วย SDK ตัวใหม่ พร้อมระบบดักจับ Error 429"""
    delay = 5
    
    for i in range(max_retries):
        try:
            # ใช้ client.models.generate_content ในการสั่งงาน (โครงสร้างใหม่)
            response = client.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
            )
            return response.text
            
        except errors.APIError as e:
            # ดักจับ Error Code 429 จาก SDK ตัวใหม่
            if e.code == 429:
                print(f"\n[⚠️ แจ้งเตือน] โควตาเต็มหรือยิงถี่เกินไป กำลังลองใหม่ในอีก {delay} วินาที... (รอบที่ {i+1}/{max_retries})")
                time.sleep(delay)
                delay *= 2
            else:
                print(f"\n[❌ เกิดข้อผิดพลาดจาก API]: {e}")
                break
        except Exception as e:
            print(f"\n[❌ เกิดข้อผิดพลาดอื่น]: {e}")
            break
            
    raise Exception("ไม่สามารถดึงข้อมูลจาก Gemini API ได้สำเร็จ")

# เริ่มต้นรันโปรแกรม
if __name__ == "__main__":
    print("🤖 กำลังเริ่มทดสอบการเชื่อมต่อด้วย SDK ตัวใหม่ (google-genai)...")
    
    test_prompt = "สวัสดี Gemini! ตอนนี้ฉันอัปเดตมาใช้ google-genai SDK ตัวล่าสุดแล้วนะ"
    
    try:
        result = generate_content_with_retry(test_prompt)
        print("\n================ ผลลัพธ์จาก Gemini ================")
        print(result)
        print("==================================================")
    except Exception as e:
        print(f"\n[โปรแกรมหยุดทำงาน]: {e}")