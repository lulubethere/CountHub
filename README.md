# CountHub
입출고 시스템

## 프로젝트 개요
CountHub는 Electron 기반의 데스크톱 입출고 관리 시스템입니다.  
엑셀 파일을 통한 입고 데이터 처리 및 검수 파일 생성을 지원합니다.

## 기술 스택
- **프레임워크**: Electron
- **데이터베이스**: PostgreSQL
- **주요 라이브러리**:
  - ExcelJS: 엑셀 파일 생성 및 처리
  - XLSX: 엑셀 파일 읽기/쓰기
  - XLSX-Populate: 엑셀 템플릿 처리
  - pg: PostgreSQL 클라이언트

## 개발 환경 설정

### 필수 요구사항
- Node.js (권장 버전: 18 이상)
- PostgreSQL 데이터베이스

### 설치 방법
#### 의존성 패키지 설치
```bash
npm install
```
#### 개발 모드 실행
```bash
npm start
```
#### 모바일 API 실행
```bash
npm run mobile:api
```
#### 데이터베이스 테스트
```bash
npm run test:db
```
#### 빌드
```bash
npm run build
```

### 데이터베이스 설정
PostgreSQL 데이터베이스 연결 설정은 `js/db.js` 파일에서 확인할 수 있습니다.

## 프로젝트 구조
```text
CountHub/
├── html/                  # HTML 페이지 파일
│   ├── 01_index.html      # 진입점 (로그인으로 리다이렉트)
│   ├── 02_login.html      # 로그인 페이지
│   ├── 03_main.html       # 메인 메뉴 페이지
│   ├── 04-01_inbound.html # 입고 페이지
│   ├── 04-02_outbound.html# 출고 페이지
│   └── partials/          # 공통 HTML 컴포넌트
│
├── js/                    # JavaScript 파일
│   ├── db.js              # 데이터베이스 연결 및 쿼리
│   ├── main.js            # Electron 메인 프로세스
│   ├── mobile-api.js      # 모바일 앱 연동용 REST API
│   ├── login.js           # 로그인 로직
│   ├── header.js          # 헤더 공통 기능
│   └── renderer-*.js      # 각 페이지별 렌더러 프로세스
│
├── style/                 # CSS 스타일 파일
│   ├── common-style.css   # 공통 스타일
│   ├── login-style.css    # 로그인 페이지 스타일
│   ├── main-style.css     # 메인 페이지 스타일
│   ├── inbound-style.css  # 입고 페이지 스타일
│   └── outbound-style.css # 출고 페이지 스타일
│
└── package.json           # 프로젝트 설정 및 의존성
```

# 기능 설명
## 입고
입고 시스템은 엑셀 파일을 통한 입고 데이터 처리를 지원합니다.

### 주요 기능
- 입고예정 엑셀 파일 업로드: 셀러로부터 받은 입고예정 엑셀 파일(.xlsx, .xls) 업로드
- 입고 정보 입력:
  - 셀러, 입고센터, 상품구분, 쇼핑몰 선택
  - 입고예정일 입력 (YYYYMMDD 형식)
  - SKU, 상품명, 유통기한, LOT, 입고예정수량 입력
- 입고파일 생성: 입력된 데이터를 기반으로 입고 파일 생성
- 입고검수파일 생성: 입고 검수에 필요한 파일 생성
- 엑셀 템플릿 관리:
  - 입고파일 양식 엑셀 템플릿 첨부 및 기본값 설정
  - 입고검수파일 양식 엑셀 템플릿 첨부 및 기본값 설정

### 사용 방법
1. 메인 메뉴에서 "입고" 버튼 클릭
2. 입고예정 엑셀 파일 업로드 (선택사항)
3. 입고 정보 입력 (셀러, 입고센터, 상품 정보 등)
4. 필요에 따라 입고파일 양식 또는 입고검수파일 양식 엑셀 템플릿 첨부
5. "입고파일 작업" 또는 "입고검수파일 작업" 버튼 클릭

## 출고
추후 업데이트 예정

## 모바일 1단계 API
갤럭시 등 모바일 앱 연동을 위한 1단계 REST API를 제공합니다.

### 기본 실행
- 기본 주소: `http://localhost:3100`
- 포트 변경: 환경변수 `MOBILE_API_PORT`

### 주요 엔드포인트
- `GET /api/mobile/health`
- `POST /api/mobile/login`
- `GET /api/mobile/item-locations?keyword=...`
- `POST /api/mobile/item-locations`
- `PUT /api/mobile/item-locations/:id`
- `PATCH /api/mobile/item-locations/:id/missing`
- `DELETE /api/mobile/item-locations/:id`
- `GET /api/mobile/item-location-groups`
- `POST /api/mobile/item-location-groups`
- `DELETE /api/mobile/item-location-groups/:name`

### 참고
- 모바일 API는 CORS 허용 상태로 열립니다.
- 그룹 목록은 DB의 `ItemLocationGroup` 테이블에서 관리됩니다.
- 현재 데스크톱 화면의 그룹 설정은 아직 로컬 저장소 기반이라, 다음 단계에서는 데스크톱도 같은 DB 그룹 목록을 쓰도록 맞추는 것이 좋습니다.

## 모바일 2단계 미리보기
모바일용 품목 위치 화면 미리보기 파일:

- `html/06 mobile-item-location.html`

### 사용 순서
1. `npm run mobile:api` 실행
2. Electron 메인 화면에서 `모바일 품목 위치` 진입
3. 연결 설정에 API 주소 입력
   - PC 테스트: `http://localhost:3100`
   - 갤럭시 테스트: `http://PC_IP:3100`
4. CountHub 사용자 이름으로 로그인
5. 품목 검색, 등록, 수정, 유령/복구 테스트

# 개발자
lulu & jjinory
# CountHub Mobile 배포 메모

## 현재 상태

- 안드로이드 테스트 앱 APK 생성 완료
- 최종 배포용 `release APK` / `AAB` 생성 완료
- 모바일 앱은 이제 **PC 로컬 서버 대신 외부 배포 API 주소**를 기본값으로 넣을 수 있도록 구성됨

## 배포 파일 위치

- 테스트 APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- 배포 APK: `android/app/build/outputs/apk/release/app-release.apk`
- 플레이스토어 업로드용 AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## 현실적인 운영 구조

현장 근무에서 휴대폰만으로 사용하려면 `js/mobile-api.js` 를 클라우드에 배포해야 합니다.

이 저장소에는 Render 배포용 설정이 포함되어 있습니다:

- `render.yaml`
- `package.json`의 `mobile:server`

## Render 권장 이유

- 공식 문서 기준 Node 웹서비스 배포가 단순함
- HTTPS 기본 제공
- 환경변수 관리 가능
- 단, 무료 웹서비스는 15분 유휴 시 자동 sleep 되므로 **현장용 운영은 Starter 이상 권장**

## Render 배포 순서

1. GitHub에 현재 프로젝트 push
2. Render에서 Blueprint 또는 Web Service 생성
3. `render.yaml` 인식
4. 환경변수 입력
   - `SUPABASE_DB_HOST`
   - `SUPABASE_DB_PORT`
   - `SUPABASE_DB_NAME`
   - `SUPABASE_DB_USER`
   - `SUPABASE_DB_PASSWORD`
5. 배포 후 발급된 URL 확인
   - 예: `https://counthub-mobile-api.onrender.com`
6. 그 URL을 기본 API 주소로 넣어 앱 재빌드

## 외부 API 주소를 기본값으로 넣어 재빌드하는 명령

PowerShell 예시:

```powershell
$env:MOBILE_DEFAULT_API_BASE_URL="https://your-render-url.onrender.com"
npm run mobile:release
```

이렇게 빌드하면 APK 안에 외부 API 기본 주소가 포함됩니다.

## 로컬 실행 명령

- PC 테스트용 API: `npm run mobile:api`
- 모바일 웹 번들 생성: `npm run mobile:buildweb`
- 안드로이드 프로젝트 동기화: `npm run mobile:sync`
- Android Studio 열기: `npm run mobile:android`
- 테스트 APK: `npm run mobile:apk`
- 배포용 APK/AAB: `npm run mobile:release`
