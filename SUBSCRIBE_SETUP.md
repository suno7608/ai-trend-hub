# AI Commerce Daily - 구독 기능 구현 가이드

## Phase 1: Google Forms + Sheets (즉시 구현)

### Step 1: Google Form 만들기

1. https://forms.google.com 접속
2. 새 양식 만들기
3. 제목: "AI Commerce Daily 구독"
4. 질문 추가:
   - **이메일 주소** (필수, 이메일 형식)
   - **이름** (필수, 단답형)
   - **회사** (선택, 단답형)
   - **개인정보 수집 동의** (필수, 체크박스)
     - 내용: "AI Commerce Daily 뉴스레터 발송을 위해 이메일 주소를 수집하는 것에 동의합니다. 언제든 구독을 취소할 수 있습니다."

5. 응답 → Google Sheets에 연결
   - "스프레드시트에 링크" 클릭
   - 새 스프레드시트 만들기: "AI Commerce Daily Subscribers"

6. Form URL 복사 (예: https://forms.gle/xxxxx)

---

### Step 2: AI Trend Hub에 Subscribe 버튼 추가

`ai-trend-hub/index.html` 수정:

```html
<!-- Hero Section에 추가 -->
<div class="subscribe-section">
  <h2>📧 AI Commerce Daily 구독</h2>
  <p>매일 아침 5시, AI 커머스 & 마케팅 최신 뉴스를 이메일로 받아보세요</p>
  <a href="https://forms.gle/YOUR_FORM_URL" 
     class="subscribe-button" 
     target="_blank">
    이메일로 구독하기
  </a>
</div>

<style>
.subscribe-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 2rem;
  border-radius: 1rem;
  text-align: center;
  color: white;
  margin: 2rem 0;
}

.subscribe-button {
  display: inline-block;
  background: white;
  color: #667eea;
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: bold;
  margin-top: 1rem;
  transition: transform 0.2s;
}

.subscribe-button:hover {
  transform: scale(1.05);
}
</style>
```

---

### Step 3: Google Sheets API 활성화

1. Google Cloud Console: https://console.cloud.google.com
2. 프로젝트 선택 (기존 프로젝트: `1074434164086`)
3. API 및 서비스 → 라이브러리
4. "Google Sheets API" 검색 → 사용 설정
5. 기존 `google-credentials.json`에 Sheets 스코프 추가됨

---

### Step 4: 구독자 이메일 읽기 스크립트

`tools/get_subscribers.py` 생성:

```python
#!/usr/bin/env python3
"""AI Commerce Daily 구독자 이메일 목록 가져오기"""

import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']
SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'  # Google Sheets URL에서 복사
RANGE_NAME = 'Form Responses 1!B2:B'  # B열 = 이메일 주소

def get_subscribers():
    """구독자 이메일 목록 반환"""
    creds = Credentials.from_authorized_user_file(
        os.path.expanduser('~/.openclaw/workspace/tools/google-token.json'),
        SCOPES
    )
    
    service = build('sheets', 'v4', credentials=creds)
    sheet = service.spreadsheets()
    
    result = sheet.values().get(
        spreadsheetId=SPREADSHEET_ID,
        range=RANGE_NAME
    ).execute()
    
    values = result.get('values', [])
    
    # 이메일 목록 (중복 제거)
    emails = list(set([row[0] for row in values if row]))
    
    return emails

if __name__ == '__main__':
    subscribers = get_subscribers()
    print(f"총 구독자: {len(subscribers)}")
    for email in subscribers:
        print(f"  - {email}")
```

**테스트:**
```bash
cd ~/Desktop/AI\ Trend_md/ai-trend-hub
python3 tools/get_subscribers.py
```

---

### Step 5: 크론잡 수정 - 이메일 발송 추가

기존 `ai-commerce-daily-collection` 크론잡 수정:

```python
# 기존 코드 끝에 추가

# 5. 구독자에게 이메일 발송
try:
    import sys
    sys.path.append(os.path.expanduser('~/Desktop/AI Trend_md/ai-trend-hub/tools'))
    from get_subscribers import get_subscribers
    from send_newsletter import send_newsletter
    
    subscribers = get_subscribers()
    
    if subscribers:
        # HTML 이메일 생성
        html_content = generate_html_newsletter(news_items)
        
        # 구독자에게 발송
        send_newsletter(
            to_emails=subscribers,
            subject=f"[AI Commerce Daily] {today_str} AI 커머스 & 마케팅 뉴스",
            html_content=html_content
        )
        
        print(f"✅ 이메일 발송 완료: {len(subscribers)}명")
except Exception as e:
    print(f"⚠️ 이메일 발송 실패: {e}")
```

---

### Step 6: HTML 이메일 템플릿

`tools/send_newsletter.py` 생성:

```python
#!/usr/bin/env python3
"""AI Commerce Daily 뉴스레터 발송"""

import os
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

SCOPES = ['https://www.googleapis.com/auth/gmail.send']

def send_newsletter(to_emails, subject, html_content):
    """뉴스레터 발송 (BCC로 일괄 발송)"""
    creds = Credentials.from_authorized_user_file(
        os.path.expanduser('~/.openclaw/workspace/tools/google-token.json'),
        SCOPES
    )
    
    service = build('gmail', 'v1', credentials=creds)
    
    # HTML 이메일 생성
    message = MIMEMultipart('alternative')
    message['From'] = 'suno7608@gmail.com'
    message['To'] = 'suno7608@gmail.com'  # 본인에게
    message['Bcc'] = ', '.join(to_emails)  # 구독자들 (숨김)
    message['Subject'] = subject
    
    # HTML 파트
    html_part = MIMEText(html_content, 'html', 'utf-8')
    message.attach(html_part)
    
    # Base64 인코딩
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    
    # 발송
    service.users().messages().send(
        userId='me',
        body={'raw': raw}
    ).execute()

def generate_html_newsletter(news_items):
    """뉴스레터 HTML 생성"""
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }}
        .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                   padding: 30px; text-align: center; color: white; }}
        .news-item {{ background: #f9f9f9; padding: 20px; margin: 15px 0; border-radius: 8px; }}
        .news-title {{ font-size: 18px; font-weight: bold; margin-bottom: 10px; }}
        .news-meta {{ color: #666; font-size: 14px; margin-bottom: 10px; }}
        .footer {{ text-align: center; padding: 20px; color: #999; font-size: 12px; }}
        a {{ color: #667eea; text-decoration: none; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📧 AI Commerce Daily</h1>
            <p>AI 커머스 & 마케팅 최신 뉴스</p>
        </div>
        
        <div style="padding: 20px 0;">
"""
    
    for item in news_items:
        html += f"""
        <div class="news-item">
            <div class="news-title">{item['emoji']} {item['title']}</div>
            <div class="news-meta">
                {item['source']} · {item['published']}
            </div>
            <p>{item['summary']}</p>
            <a href="{item['url']}" target="_blank">더 읽기 →</a>
        </div>
"""
    
    html += f"""
        </div>
        
        <div class="footer">
            <p>이 이메일은 AI Commerce Daily 구독자에게 발송되었습니다.</p>
            <p><a href="mailto:suno7608@gmail.com?subject=구독취소">구독 취소</a></p>
        </div>
    </div>
</body>
</html>
"""
    return html

if __name__ == '__main__':
    # 테스트
    test_html = "<h1>Test Newsletter</h1>"
    send_newsletter(
        to_emails=['suno7608@gmail.com'],
        subject="[Test] AI Commerce Daily",
        html_content=test_html
    )
    print("✅ 테스트 이메일 발송 완료")
```

---

## 법적 준수 사항

### 개인정보 수집 동의
- Google Form에 명시적 동의 체크박스 추가
- 수집 목적: AI Commerce Daily 뉴스레터 발송
- 보관 기간: 구독 취소 시까지

### 구독 취소 (Unsubscribe)
- 모든 이메일 하단에 "구독 취소" 링크 필수
- 방법: `mailto:suno7608@gmail.com?subject=구독취소`
- 또는 Google Sheets에서 수동 삭제

### 스팸 방지
- BCC 사용 (구독자 이메일 노출 방지)
- 1회 발송 제한 (일 1회)
- 명확한 발신자 정보 표시

---

## 다음 단계

### 즉시 (오늘)
1. [ ] Google Form 생성
2. [ ] Google Sheets 연결
3. [ ] Sheets API 활성화
4. [ ] `get_subscribers.py` 생성 및 테스트
5. [ ] AI Trend Hub에 Subscribe 버튼 추가

### 이번 주
1. [ ] `send_newsletter.py` 생성
2. [ ] HTML 템플릿 디자인
3. [ ] 크론잡 수정 (이메일 발송 추가)
4. [ ] 테스트 발송 (본인 이메일)
5. [ ] 실제 구독자 발송

### 다음 단계 (Phase 2)
1. [ ] Netlify 마이그레이션 검토
2. [ ] Double opt-in 구현
3. [ ] 발송 통계 추가

---

## 참고

- Google Sheets API: https://developers.google.com/sheets/api
- Gmail API Send: https://developers.google.com/gmail/api/guides/sending
- GDPR 준수: https://gdpr.eu/email-encryption/
