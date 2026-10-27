const STORAGE_KEY = "wage-meter-settings";
const BASIC_DEDUCTION_YEARLY = 1_500_000;

const form = document.getElementById("settings-form");
const payTypeInput = document.getElementById("pay-type");
const amountLabel = document.getElementById("amount-label");
const salaryInput = document.getElementById("salary");
const startInput = document.getElementById("start-time");
const endInput = document.getElementById("end-time");
const dependentsInput = document.getElementById("dependents");
const childrenInput = document.getElementById("children");
const formError = document.getElementById("form-error");
const saveNote = document.getElementById("save-note");
const fareEl = document.getElementById("fare");
const elapsedEl = document.getElementById("elapsed");
const statusEl = document.getElementById("status-pill");
const hourlyEl = document.getElementById("hourly");
const perSecondEl = document.getElementById("per-second");
const dailyEl = document.getElementById("daily");
const dailyLabelEl = document.getElementById("daily-label");
const familyCountEl = document.getElementById("family-count");
const childCountEl = document.getElementById("child-count");
const taxFreeEl = document.getElementById("tax-free");

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
      payType: normalizePayType(parsed.payType),
      dependents: normalizeDependents(parsed.dependents),
      children: normalizeChildren(parsed.children, normalizeDependents(parsed.dependents)),
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

function parseCount(value) {
  const digits = String(value).replace(/[^\d]/g, "");
  return digits ? Number(digits) : NaN;
}

function normalizeDependents(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1) return 1;
  return Math.min(count, 20);
}

function normalizeChildren(value, dependents) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) return 0;
  return Math.min(count, Math.max(0, dependents - 1), 19);
}

function childTaxCreditMonthly(children) {
  if (children <= 0) return 0;
  if (children === 1) return 20_830;
  if (children === 2) return 45_830;
  return 45_830 + 33_330 * (children - 2);
}

function monthlyTaxFree(dependents, children) {
  return (BASIC_DEDUCTION_YEARLY * dependents) / 12 + childTaxCreditMonthly(children);
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

function normalizePayType(value) {
  if (value === "monthly" || value === "daily") return value;
  return "annual";
}

function dailyAmount(current, workDays) {
  if (current.payType === "daily") return current.salary;
  if (current.payType === "monthly") return current.salary / workDays;
  return current.salary / 12 / workDays;
}

const LUNAR_HOLIDAYS = {
  2025: {
    seollal: [[1, 28], [1, 29], [1, 30]],
    chuseok: [[10, 5], [10, 6], [10, 7]],
    buddha: [5, 5],
  },
  2026: {
    seollal: [[2, 16], [2, 17], [2, 18]],
    chuseok: [[9, 24], [9, 25], [9, 26]],
    buddha: [5, 24],
  },
  2027: {
    seollal: [[2, 6], [2, 7], [2, 8]],
    chuseok: [[9, 14], [9, 15], [9, 16]],
    buddha: [5, 13],
  },
};

function padDate(value) {
  return String(value).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${padDate(month)}-${padDate(day)}`;
}

function weekday(year, month, day) {
  return new Date(year, month - 1, day).getDay();
}

function nextOpenDay(year, month, day, holidays) {
  const date = new Date(year, month - 1, day);
  while (true) {
    date.setDate(date.getDate() + 1);
    const key = dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const dow = date.getDay();
    if (dow !== 0 && dow !== 6 && !holidays.has(key)) return key;
  }
}

function holidaysForYear(year) {
  const holidays = new Set();
  const add = (month, day) => holidays.add(dateKey(year, month, day));

  for (const [month, day] of [
    [1, 1],
    [3, 1],
    [5, 1],
    [5, 5],
    [6, 6],
    [8, 15],
    [10, 3],
    [10, 9],
    [12, 25],
  ]) {
    add(month, day);
  }

  const lunar = LUNAR_HOLIDAYS[year];
  if (lunar) {
    for (const [month, day] of lunar.seollal) add(month, day);
    for (const [month, day] of lunar.chuseok) add(month, day);
    add(lunar.buddha[0], lunar.buddha[1]);
  }

  const substituteTargets = [
    [3, 1],
    [5, 5],
    [8, 15],
    [10, 3],
    [10, 9],
    [12, 25],
  ];
  if (lunar) substituteTargets.push(lunar.buddha);

  for (const [month, day] of substituteTargets) {
    const dow = weekday(year, month, day);
    if (dow === 0 || dow === 6) {
      holidays.add(nextOpenDay(year, month, day, holidays));
    }
  }

  if (lunar) {
    for (const span of [lunar.seollal, lunar.chuseok]) {
      if (span.some(([month, day]) => weekday(year, month, day) === 0)) {
        const [month, day] = span[span.length - 1];
        holidays.add(nextOpenDay(year, month, day, holidays));
      }
    }
  }

  return holidays;
}

function workDaysInMonth(now) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const holidays = holidaysForYear(year);
  const lastDay = new Date(year, month, 0).getDate();
  let days = 0;

  for (let day = 1; day <= lastDay; day += 1) {
    const dow = weekday(year, month, day);
    if (dow === 0 || dow === 6) continue;
    if (holidays.has(dateKey(year, month, day))) continue;
    days += 1;
  }

  return days;
}

function payLabel(payType) {
  if (payType === "monthly") return "월급";
  if (payType === "daily") return "일급";
  return "연봉";
}

function syncPayTypeUi(payType) {
  const type = normalizePayType(payType);
  amountLabel.textContent = payLabel(type);
  if (type === "monthly") salaryInput.placeholder = "4,000,000";
  else if (type === "daily") salaryInput.placeholder = "200,000";
  else salaryInput.placeholder = "50,000,000";
}

function rates(current, now) {
  const hours = dailyHours(parseClock(current.startTime), parseClock(current.endTime));
  const workDays = Math.max(1, workDaysInMonth(now));
  const daily = dailyAmount(current, workDays);
  const hourly = daily / hours;
  return {
    hours,
    hourly,
    perSecond: hourly / 3600,
    daily,
    workDays,
    month: now.getMonth() + 1,
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
  const { hourly, perSecond, daily, workDays, month } = rates(current, now);

  if (now < startAt) {
    return { status: "before", fare: 0, elapsedMs: 0, hourly, perSecond, daily, workDays, month };
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
    workDays,
    month,
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
  dailyLabelEl.textContent = "하루 정산";
  familyCountEl.textContent = "—";
  childCountEl.textContent = "—";
  taxFreeEl.textContent = "—";
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
  dailyLabelEl.textContent = `하루 정산 (${state.month}월 ${state.workDays}일)`;
  dailyEl.textContent = `${won.format(Math.round(state.daily))}원`;
  familyCountEl.textContent = `${settings.dependents}명`;
  childCountEl.textContent = `${settings.children}명`;
  taxFreeEl.textContent = `${won.format(Math.round(monthlyTaxFree(settings.dependents, settings.children)))}원`;

  if (state.status === "before") setStatus("before", "출근 전");
  if (state.status === "work") setStatus("work", "근무 중");
  if (state.status === "after") setStatus("after", "퇴근");
}

function fillForm(current) {
  const payType = normalizePayType(current?.payType);
  payTypeInput.value = payType;
  syncPayTypeUi(payType);
  salaryInput.value = current ? formatSalary(current.salary) : "";
  startInput.value = current?.startTime || "09:00";
  endInput.value = current?.endTime || "18:00";
  dependentsInput.value = String(current ? current.dependents : 1);
  childrenInput.value = String(current ? current.children : 0);
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

  const payType = normalizePayType(payTypeInput.value);
  const salary = parseSalary(salaryInput.value);
  const startTime = startInput.value;
  const endTime = endInput.value;
  const dependents = parseCount(dependentsInput.value);
  const children = parseCount(childrenInput.value);

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
  if (!Number.isInteger(dependents) || dependents < 1) {
    showError("부양가족수는 본인을 포함해 1명 이상이어야 합니다.");
    return;
  }
  if (!Number.isInteger(children) || children < 0) {
    showError("20세 이하 자녀수를 입력해 주세요.");
    return;
  }
  if (children > dependents - 1) {
    showError("자녀수는 본인을 제외한 부양가족수를 넘을 수 없습니다.");
    return;
  }

  saveSettings({ payType, salary, startTime, endTime, dependents, children });
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
