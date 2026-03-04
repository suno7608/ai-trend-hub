#!/bin/bash
set -e

echo "🚀 Subscribe 버튼 자동 추가 스크립트"
echo ""

cd ~/Desktop/AI\ Trend_md/ai-trend-hub

# 1. templates.js에 renderSubscribeSection 함수 추가
echo "1️⃣ templates.js 수정 중..."

# renderArchiveSearch 함수 뒤에 renderSubscribeSection 추가
cat >> scripts/templates.js << 'EOF'

function renderSubscribeSection() {
  return `
    <div class="subscribe-section">
      <div class="container">
        <h2>📧 AI Commerce Daily 구독</h2>
        <p>매일 아침 5시, AI 커머스 & 마케팅 최신 뉴스를 이메일로 받아보세요</p>
        <a href="https://docs.google.com/forms/d/e/1FAIpQLScO-1KzFXSI7thfY6QudDoW_JKnVEBMjCeXzjmakSMl-Qgf3g/viewform" 
           class="subscribe-button" 
           target="_blank"
           rel="noopener">
          이메일로 구독하기 →
        </a>
      </div>
    </div>
  `;
}
EOF

# module.exports에 renderSubscribeSection 추가
sed -i '' 's/renderArchiveSearch$/renderArchiveSearch,\n  renderSubscribeSection/' scripts/templates.js

echo "✅ templates.js 완료"

# 2. build.js 수정
echo "2️⃣ build.js 수정 중..."

# Home 페이지 생성 부분 찾아서 subscribeSection 추가
sed -i '' '/const statsBar = /a\
  const subscribeSection = T.renderSubscribeSection();
' scripts/build.js

# bodyContent에 subscribeSection 포함 (statsBar 다음에)
sed -i '' 's/statsBar + searchBar/statsBar + subscribeSection + searchBar/' scripts/build.js

echo "✅ build.js 완료"

# 3. CSS 추가
echo "3️⃣ CSS 추가 중..."

cat >> dist/assets/css/style.css << 'EOF'

/* Subscribe Section */
.subscribe-section {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 3rem 0;
  text-align: center;
  color: white;
  margin: 2rem 0;
}

.subscribe-section h2 {
  font-size: 1.8rem;
  margin-bottom: 1rem;
  font-weight: 600;
}

.subscribe-section p {
  font-size: 1.1rem;
  margin-bottom: 1.5rem;
  opacity: 0.95;
}

.subscribe-button {
  display: inline-block;
  background: white;
  color: #667eea;
  padding: 0.875rem 2rem;
  border-radius: 50px;
  font-weight: 600;
  font-size: 1rem;
  text-decoration: none;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}

.subscribe-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.3);
  color: #764ba2;
}
EOF

echo "✅ CSS 완료"

echo ""
echo "🎉 Subscribe 버튼 추가 완료!"
echo ""
echo "다음 단계:"
echo "1. node scripts/build.js (빌드)"
echo "2. open dist/index.html (확인)"
