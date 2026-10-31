# 차경(茶境)

가입 없이 토끼가 되어 차를 마시며 잠시 머무는 3D 온라인 다실입니다. React 19, React Three Fiber, Vinext, Cloudflare Workers와 D1으로 동작합니다.

## 로컬 실행

```bash
npm install
npm run db:generate
npm run build
npm run dev
```

로컬 D1은 빌드 후 생성되는 Wrangler 설정을 사용해 `drizzle/`의 마이그레이션을 적용해야 합니다. 자세한 명령은 Vinext 스타터의 로컬 D1 안내를 따릅니다.

## 주요 구조

- `app/`: 화면과 D1 API 라우트
- `components/`: 3D 다실, 토끼, 다구, UI
- `hooks/use-tea-room.ts`: 세션, heartbeat, presence 동기화
- `lib/`: 공유 타입, 카탈로그, 경로 탐색, 시간대 계산
- `db/`: D1 스키마
- `docs/`: 제품·디자인·로드맵 문서

## 배포

`.openai/hosting.json`의 Site ID와 D1 바인딩을 유지한 채 Sites 빌드·패키징 워크플로로 배포합니다. 운영 D1 마이그레이션은 Sites가 배포 과정에서 적용합니다.

## 테스트용 시간 강제

URL에 `?time=day`, `?time=dusk`, `?time=night`를 추가하면 조명을 고정할 수 있습니다.
