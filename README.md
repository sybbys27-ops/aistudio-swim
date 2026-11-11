<img width="1243" height="806" alt="Freestyle Simulation" src="https://github.com/user-attachments/assets/8249afe7-a248-4855-9686-13a3aba55122" />

# AeroSwim Pro - Freestyle Simulation

자유형 수영의 **롤링, 스트로크 타이밍, 글라이드, 자세, 추진력, 에너지 소모**를 직접 조절하고 결과를 실시간으로 확인할 수 있는 3D 시뮬레이터입니다.

현재 1단계에서는 50m 자유형 시뮬레이션을 중심으로, 사용자가 수영 파라미터를 변경하면서 속도와 에너지 효율의 변화를 비교할 수 있도록 구성했습니다.

## 주요 기능

### 1. 자유형 타이밍 모델
- Rolling Angle 조절
- Rolling Time 조절
- Glide Duration 조절
- Stroke Time 자동 계산
- Stroke Interval 조절
- 좌·우 팔의 독립적인 스트로크 타임라인
- Catch → Pull → Push → Recovery 단계 표현
- 스트로크 간 겹침 동작 지원

### 2. 롤링 및 자세 시뮬레이션
- 선택한 Rolling Angle에 따라 몸통 회전
- 초기 오른쪽 롤링 후 좌·우 롤링 반복
- Body Pitch 조절
- 롤링 각도와 자세에 따른 에너지 및 추진 효율 변화

### 3. 속도·추진력 모델
- Pull / Push 구간별 추진력 계산
- Rolling Angle에 따른 추진 효율 적용
- Stroke Time에 따른 추진 효율 적용
- Body Pitch에 따른 저항 증가
- 스트로크가 없는 구간에서는 감속 저항 완화
- 최소 킥 속도 0.3 m/s 유지

### 4. 에너지 시스템
- 시작 Energy 100%
- 스트로크마다 기본 에너지 소모
- 부적절한 Rolling Angle, Stroke Time, Body Pitch에 추가 패널티
- Glide Duration 동안 에너지 회복
- 실시간 Energy Bar 표시
- Energy가 낮아질수록 상단 숫자 색상 변화

### 5. 실시간 분석 UI
- Current Speed
- Distance
- Active Arm
- Efficiency
- Stroke Rate
- Thrust 그래프
- Speed 그래프
- 현재 Roll Angle
- Elapsed Time
- 파라미터별 에너지/추진 효율 감소 메시지

왼쪽 Parameter Controls와 오른쪽 Real-time Analytics 패널은 각각 접어서 수영 장면을 넓게 볼 수 있습니다.

### 6. 카메라 모드
- SIDE
- TOP
- FOLLOW
- FRONT

기본 카메라는 FOLLOW 모드입니다.

### 7. 50m 수영장 및 거리 표시
- 50m 풀 기반 시뮬레이션
- 수영장 바닥에 10m / 20m / 30m / 40m 거리 마커 표시
- 실시간 이동 거리 표시

### 8. 결과 화면
50m 완주 시 다음 결과를 표시합니다.

- Final Score
- Remaining Energy
- Total Time
- Average Speed

Final Score는 현재 다음 식을 사용합니다.

```text
Final Score = Remaining Energy + 80 - Elapsed Time
```

Energy가 완전히 소진되어 수영을 지속할 수 없으면 FAIL 결과가 표시됩니다.

### 9. 배경음악
- 자체 제작 BGM `시간이_멈춘_바다.mp3`
- 시뮬레이션 시작 시 음악 재생
- 기본 음량 50%
- 상단 Volume Slider로 실시간 조절
- 시뮬레이션 종료 후에도 웹 페이지를 닫을 때까지 음악 계속 재생
- 반복 재생 지원

## 기술 스택

- React
- TypeScript
- Vite
- Three.js
- React Three Fiber
- Drei
- Tailwind CSS
- Recharts

## 로컬 실행

### 준비 사항
- Node.js
- npm

### 실행 방법

```bash
git clone https://github.com/sybbys27-ops/aistudio-swim.git
cd aistudio-swim
npm install
npm run dev
```

브라우저에서 Vite가 안내하는 로컬 주소로 접속하면 됩니다.

## 빌드

```bash
npm run build
```

빌드 결과는 `dist` 폴더에 생성됩니다.

## 현재 개발 상태

**Stage 1 - 50m Freestyle Simulation 완료**

현재 버전은 50m 자유형 기록과 파라미터별 효율 비교에 초점을 맞추고 있습니다.

다음 단계에서는 Vercel 배포와 함께, 50m마다 턴을 수행하며 에너지가 소진될 때까지 계속 수영하는 **ENDLESS MODE** 확장을 계획하고 있습니다.

---

AeroSwim Pro는 실제 수영의 모든 물리 현상을 완전히 재현하는 목적보다는, 자유형의 주요 동작 요소와 타이밍을 수치화해 서로 비교하고 실험할 수 있도록 만든 인터랙티브 시뮬레이션입니다.
