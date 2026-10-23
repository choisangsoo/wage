const STORAGE_KEY = "wage-meter-settings";
const WORK_DAYS_PER_YEAR = 260;

const form = document.getElementById("settings-form");
const payTypeInput = document.getElementById("pay-type");
const amountLabel = document.getElementById("amount-label");
const salaryInput = document.getElementById("salary");
const startInput = document.getElementById("start-time");
const endInput = document.getElementById("end-time");
const formError = document.getElementById("form-error");
const saveNote = document.getElementById("save-note");
const fareEl = document.getElementById("fare");
const elapsedEl = document.getElementById("elapsed");
const statusEl = document.getElementById("status-pill");
const hourlyEl = document.getElementById("hourly");
const perSecondEl = document.getElementById("per-second");
const dailyEl = document.getElementById("daily");

const won = new Intl.NumberFormat("ko-KR");
const wonExact = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

let settings = loadSettings();

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.salary || !parsed?.startTime || !parsed?.endTime) return null;
    return {
      ...parsed,
      payType: parsed.payType === "monthly" ? "monthly" : "annual",
    };
  } catch {
    return null;
  }
}

function saveSettings(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  settings = next;
}

function parseSalary(value) {
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function formatSalary(value) {
  return value ? won.format(value) : "";
}

function parseClock(value) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return { hours, minutes };
}

function atClock(base, clock) {
  const date = new Date(base);
  date.setHours(clock.hours, clock.minutes, 0, 0);
  return date;
}

function dailyHours(start, end) {
  let minutes = end.hours * 60 + end.minutes - (start.hours * 60 + start.minutes);
  if (minutes <= 0) minutes += 24 * 60;
  return minutes / 60;
}

function annualSalary(current) {
  return current.payType === "monthly" ? current.salary * 12 : current.salary;
}

function payLabel(payType) {
  return payType === "monthly" ? "월급" : "연봉";
}

function syncPayTypeUi(payType) {
  const type = payType === "monthly" ? "monthly" : "annual";
  amountLabel.textContent = payLabel(type);
  salaryInput.placeholder = type === "monthly" ? "4,000,000" : "50,000,000";
}

function rates(current) {
  const hours = dailyHours(parseClock(current.startTime), parseClock(current.endTime));
  const hourly = annualSalary(current) / WORK_DAYS_PER_YEAR / hours;
  return {
    hours,
    hourly,
    perSecond: hourly / 3600,
    daily: hourly * hours,
  };
}

function workWindow(now, current) {
  const start = parseClock(current.startTime);
  const end = parseClock(current.endTime);
  let startAt = atClock(now, start);
  let endAt = atClock(now, end);

  if (endAt <= startAt) {
    if (now < startAt && now <= endAt) {
      startAt.setDate(startAt.getDate() - 1);
    } else {
      endAt.setDate(endAt.getDate() + 1);
    }
  }

  return { startAt, endAt };
}

function meterState(now, current) {
  const { startAt, endAt } = workWindow(now, current);
  const { hourly, perSecond, daily } = rates(current);

  if (now < startAt) {
    return { status: "before", fare: 0, elapsedMs: 0, hourly, perSecond, daily };
  }

  const until = now < endAt ? now : endAt;
  const elapsedMs = until.getTime() - startAt.getTime();
  return {
    status: now < endAt ? "work" : "after",
    fare: (elapsedMs / 1000) * perSecond,
    elapsedMs,
    hourly,
    perSecond,
    daily,
  };
}

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(total / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function setStatus(_kind, label) {
  statusEl.textContent = label;
}

function renderIdle() {
  fareEl.textContent = "₩ 0";
  elapsedEl.textContent = "00:00:00";
  hourlyEl.textContent = "—";
  perSecondEl.textContent = "—";
  dailyEl.textContent = "—";
  setStatus("idle", "대기");
}

function renderMeter(now) {
  if (!settings) {
    renderIdle();
    return;
  }

  const state = meterState(now, settings);
  fareEl.textContent = `₩ ${won.format(Math.floor(state.fare))}`;
  elapsedEl.textContent = formatElapsed(state.elapsedMs);
  hourlyEl.textContent = `${won.format(Math.round(state.hourly))}원`;
  perSecondEl.textContent = `${wonExact.format(state.perSecond)}원`;
  dailyEl.textContent = `${won.format(Math.round(state.daily))}원`;

  if (state.status === "before") setStatus("before", "출근 전");
  if (state.status === "work") setStatus("work", "근무 중");
  if (state.status === "after") setStatus("after", "퇴근");
}

function fillForm(current) {
  const payType = current?.payType === "monthly" ? "monthly" : "annual";
  payTypeInput.value = payType;
  syncPayTypeUi(payType);
  salaryInput.value = current ? formatSalary(current.salary) : "";
  startInput.value = current?.startTime || "09:00";
  endInput.value = current?.endTime || "18:00";
}

function showError(message) {
  formError.hidden = !message;
  formError.textContent = message || "";
}

payTypeInput.addEventListener("change", () => {
  syncPayTypeUi(payTypeInput.value);
});

salaryInput.addEventListener("input", () => {
  const salary = parseSalary(salaryInput.value);
  const cursorAtEnd = salaryInput.selectionStart === salaryInput.value.length;
  salaryInput.value = formatSalary(salary);
  if (cursorAtEnd) salaryInput.setSelectionRange(salaryInput.value.length, salaryInput.value.length);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const payType = payTypeInput.value === "monthly" ? "monthly" : "annual";
  const salary = parseSalary(salaryInput.value);
  const startTime = startInput.value;
  const endTime = endInput.value;

  if (!salary) {
    showError(`${payLabel(payType)}을 원화로 입력해 주세요.`);
    return;
  }
  if (!parseClock(startTime) || !parseClock(endTime)) {
    showError("출퇴근 시간을 모두 입력해 주세요.");
    return;
  }
  if (startTime === endTime) {
    showError("출근과 퇴근 시간이 같으면 하루 근무시간을 계산할 수 없습니다.");
    return;
  }

  saveSettings({ payType, salary, startTime, endTime });
  fillForm(settings);
  showError("");
  saveNote.textContent = "저장됨. 다시 입력하기 전까지 이 값을 씁니다.";
  renderMeter(new Date());
});

fillForm(settings);
if (settings) {
  saveNote.textContent = "저장된 기본값입니다. 바꾸려면 다시 저장하세요.";
}

renderMeter(new Date());
setInterval(() => renderMeter(new Date()), 100);
