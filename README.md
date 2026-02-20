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
# 의존성 패키지 설치
```bash
npm install
```
# 개발 모드 실행
```bash
npm start
```
# 데이터베이스 테스트
```bash
npm run test:db
```

# 빌드
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

# 개발자
lulu & jjinory