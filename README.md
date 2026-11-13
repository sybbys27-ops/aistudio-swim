<img width="1243" height="806" alt="Freestyle Simulation" src="https://github.com/user-attachments/assets/8249afe7-a248-4855-9686-13a3aba55122" />

# AeroSwim Pro - Freestyle Simulation

AeroSwim Pro는 자유형 수영의 **롤링, 스트로크 타이밍, 글라이드, 자세, 추진력, 속도, 에너지 소모**를 직접 조절하고 결과를 비교할 수 있는 3D 시뮬레이터입니다.

현재는 서로 성격이 다른 두 가지 모드를 제공합니다.

- **50m Mode**: 단거리 자유형의 속도와 에너지 효율을 함께 평가
- **ENDLESS Mode**: 장거리 자유형의 편안한 리듬과 지속 가능성을 평가

## 주요 기능

### 1. 자유형 타이밍 모델
- Rolling Angle 조절
- Rolling Time 조절
- Glide Duration 조절
- Stroke Time 자동 계산
- Stroke Interval 조절
- 좌·우 팔 독립 스트로크 타임라인
- Catch → Pull → Push → Recovery 단계 표현
- 스트로크 간 겹침 동작 지원

기본 Rolling Time은 **2.5초**입니다.

### 2. 롤링 및 자세
- 선택한 Rolling Angle에 따라 몸통 회전
- 초기 오른쪽 롤링 후 좌·우 롤링 반복
- Body Pitch 조절
- 롤링 각도와 자세에 따른 에너지 및 추진 효율 변화
- 실시간 Roll Angle 표시

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
- Glide Duration에 따른 에너지 회복
- 실시간 Energy Bar 표시
- Energy가 낮아질수록 상단 숫자 색상 변화

## 50m Mode

50m Mode는 **단거리 자유형에서 속도와 에너지 효율을 함께 비교하는 테스트 모드**입니다.

50m 완주 시 다음 결과를 표시합니다.

- Final Score
- Remaining Energy
- Total Time
- Average Speed

Final Score는 다음 식을 사용합니다.

```text
Base Score  = Remaining Energy + 80 - Elapsed Time
Avg Speed   = 50 / Elapsed Time
Final Score = Base Score × Avg Speed
```

따라서 같은 에너지를 남기더라도 더 빠르게 50m를 완주하면 더 높은 점수를 받습니다.

Energy가 완전히 소진되어 50m를 완주하지 못하면 FAIL이 표시됩니다.

## ENDLESS Mode

ENDLESS Mode는 **장거리 자유형에서 편안하고 효율적인 리듬을 얼마나 오래 유지할 수 있는지** 확인하는 모드입니다.

### ENDLESS 에너지 규칙
- 기본 Stroke Cost: **3.5E**
- Turn Cost: **-4E / Turn**
- Comfort Rhythm: 조건 만족 시 **+1E / 좌·우 1 Cycle**
- Glide Recovery:
  - 1.5초까지는 최대 +1.5E
  - 1.75초는 +1.25E
  - 2.0초는 +1.0E

Comfort Rhythm 조건:

```text
3.0s ≤ Stroke Time ≤ 4.0s
Stroke Time - 0.5s ≤ Stroke Interval ≤ Stroke Time
```

즉 너무 빠른 스트로크보다 편안한 장거리 리듬을 유지할수록 에너지 효율이 좋아집니다.

### ENDLESS Turn
50m 양쪽 벽에서 동일한 Turn을 수행합니다.

1. 벽 도착 후 +75° Roll
2. 몸 전체가 머리가 수면 위쪽으로 넘어가며 180° 회전
3. 동시에 Roll +75° → +180°로 추가 회전
4. 반대 방향의 정상 자유형 자세로 정렬
5. 수심 약 1m에서 수평 자세로 출발
6. 약 5m 수중 Glide 동안 수면으로 상승
7. 수면 복귀 후 왼팔(파란 손)부터 Stroke 재시작

양쪽 벽 모두 같은 형태의 Turn을 사용합니다.

### ENDLESS 종료
Energy가 0이 되면 기록이 종료됩니다.

Turn 중 Energy가 0이 된 경우에는 Turn과 5m 수중 Glide를 끝낸 뒤 수면으로 복귀하고, 그 다음 가라앉으며 종료됩니다.

ENDLESS 결과 화면에는 다음을 표시합니다.

- Total Distance
- Total Time
- Average Speed
- Completed Lengths
- Turns

## 실시간 분석 UI
- Current Speed
- Distance
- Active Arm
- Efficiency
- Stroke Rate
- Thrust 그래프
- Speed 그래프
- 현재 Roll Angle
- Elapsed Time
- 에너지/속도 효율 패널티
- ENDLESS Comfort Rhythm 보너스

왼쪽 Parameter Controls와 오른쪽 Real-time Analytics 패널은 각각 접을 수 있습니다.

## 카메라 모드
- SIDE
- TOP
- FOLLOW
- FRONT

기본 카메라는 FOLLOW 모드입니다. ENDLESS에서는 왕복 진행 방향에 맞춰 FOLLOW / FRONT 카메라가 수영자를 따라갑니다.

## 수영장
- 50m 풀
- 약 2m 수심
- 10m / 20m / 30m / 40m 거리 마커
- 실시간 이동 거리 표시

## 배경음악
- 자체 제작 BGM `시간이_멈춘_바다.mp3`
- 시뮬레이션 시작 시 재생
- 기본 음량 50%
- 상단 Volume Slider 조절
- 음소거 / 음소거 해제 버튼
- 반복 재생
- 시뮬레이션 종료 후에도 페이지가 열려 있는 동안 재생 유지

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

```bash
git clone https://github.com/sybbys27-ops/aistudio-swim.git
cd aistudio-swim
npm install
npm run dev
```

## 빌드

```bash
npm run lint
npm run build
```

빌드 결과는 `dist` 폴더에 생성됩니다.

## 현재 개발 상태

**Stage 2 - 50m + ENDLESS Freestyle Simulation 완료**

- 50m Mode: 단거리 속도·에너지 효율 테스트
- ENDLESS Mode: 장거리 리듬·에너지 지속성 테스트
- 양방향 Turn 및 수중 5m Glide 구현
- ENDLESS 전용 Comfort Rhythm / Glide Recovery / Turn Energy 적용
- 실시간 분석 및 결과 화면 구현
- Vercel 배포 구조 지원

---

AeroSwim Pro는 실제 수영의 모든 물리 현상을 완전히 재현하기보다, 자유형의 주요 동작 요소와 타이밍을 수치화해 서로 비교하고 실험할 수 있도록 만든 인터랙티브 시뮬레이션입니다.
