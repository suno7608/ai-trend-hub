# AI Trend Hub — GitHub Pages 배포 가이드

## 사전 준비
- Git이 설치되어 있어야 합니다
- GitHub 계정이 필요합니다
- Node.js 18+ 설치 권장

---

## Step 1: GitHub 레포지토리 생성

1. https://github.com/new 접속
2. Repository name: `ai-trend-hub`
3. Public 선택 (GitHub Pages 무료 사용을 위해)
4. "Create repository" 클릭
5. 아직 아무것도 추가하지 말고 빈 레포로 생성

---

## Step 2: 로컬에서 Git 초기화 및 Push

터미널에서 `ai-trend-hub` 폴더로 이동한 후:

```bash
cd ai-trend-hub

# Git 초기화
git init
git branch -M main

# 전체 파일 스테이징 (node_modules 제외 - .gitignore에 포함됨)
git add .

# 첫 커밋
git commit -m "Initial commit: AI Trend Hub PoC with 10 daily + 1 weekly + 1 monthly content"

# 원격 레포 연결 (본인 GitHub 유저네임으로 변경)
git remote add origin https://github.com/YOUR_USERNAME/ai-trend-hub.git

# Push
git push -u origin main
```

---

## Step 3: GitHub Pages 활성화

### 방법 A: GitHub Actions 자동 배포 (권장)

1. GitHub 레포 페이지 → **Settings** 탭
2. 왼쪽 메뉴에서 **Pages** 클릭
3. **Source** 드롭다운에서 **GitHub Actions** 선택
4. Push하면 `.github/workflows/deploy.yml`이 자동 실행됨
5. Actions 탭에서 빌드 성공 확인
6. 약 1~2분 후 사이트 접속 가능: `https://YOUR_USERNAME.github.io/ai-trend-hub/`

### 방법 B: dist 폴더 직접 배포

만약 Actions가 잘 안 되면:
1. Settings → Pages → Source에서 **Deploy from a branch** 선택
2. Branch: `main`, Folder: `/dist` 선택
3. Save

---

## Step 4: 배포 확인

- `https://YOUR_USERNAME.github.io/ai-trend-hub/` 접속
- Daily Feed 10건 표시 확인
- Weekly Digest / Monthly Deep Dive 섹션 확인
- 언어 토글 (KO/EN) 동작 확인
- 모바일에서도 접속 확인

---

## 콘텐츠 업데이트 방법

### 수동 업데이트
```bash
# 새 Daily 콘텐츠 추가
# content/daily/ 에 마크다운 파일 생성 후:

npm run build      # 사이트 재빌드
npm run validate   # 스키마 검증

git add .
git commit -m "📰 Daily content update YYYY-MM-DD"
git push
# → GitHub Actions가 자동으로 빌드 & 배포
```

### 자동 업데이트 (GitHub Actions)
- `.github/workflows/daily-content.yml`이 매일 UTC 06:00 (KST 15:00)에 실행
- 현재는 템플릿 상태이며, `scripts/collect.js`를 AI API와 연동하면 완전 자동화 가능

---

## 주요 NPM 스크립트

```bash
npm run build       # 마크다운 → HTML 정적 사이트 생성
npm run validate    # YAML 스키마 검증
npm run collect     # RSS 피드 수집 (PoC)
```

---

## 프로젝트 구조

```
ai-trend-hub/
├── .github/workflows/    # CI/CD 파이프라인
│   ├── deploy.yml        # Push 시 자동 빌드/배포
│   └── daily-content.yml # 일일 콘텐츠 수집 (템플릿)
├── assets/
│   ├── css/style.css     # 사이트 스타일
│   └── js/app.js         # 클라이언트 인터랙션
├── content/
│   ├── daily/            # 일일 뉴스 (10건)
│   ├── weekly/           # 주간 다이제스트 (1건)
│   └── monthly/          # 월간 딥다이브 (1건)
├── data/
│   ├── sources.yaml      # 46개 소스 목록
│   ├── events.yaml       # 컨퍼런스/이벤트
│   └── influencers.yaml  # 인플루언서 목록
├── dist/                 # 빌드 결과물 (GitHub Pages 배포 대상)
├── scripts/
│   ├── build.js          # 정적 사이트 빌더
│   ├── validate.js       # 스키마 검증기
│   └── collect.js        # RSS 수집기 (PoC)
└── package.json
```

---

## 다음 단계 (로드맵)

1. **RSS 수집 자동화**: `collect.js`에 실제 AI API(Claude/OpenAI) 연동
2. **소스 확장**: 7개 → 20개+ 활성 소스
3. **Weekly 자동 생성**: Daily 50건 누적 시 자동 Weekly Digest 생성
4. **반응(Thumbs Up) 기능**: Google Form 또는 GitHub Issues 활용
5. **검색 기능**: lunr.js 기반 클라이언트 사이드 검색
