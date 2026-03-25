const DEFAULT_MIN_AGE = 19;
const EDU_MIN_AGE = 21;

export { DEFAULT_MIN_AGE, EDU_MIN_AGE };

function isValidDateParts(year: number, month: number, day: number): boolean {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function calculateAge(
  birthDate: string,
  todayDate: Date = new Date(),
): number | null {
  const birthParts = birthDate.split("-").map(Number);

  if (birthParts.length !== 3) {
    return null;
  }

  const [birthYear, birthMonth, birthDay] = birthParts;

  if (!isValidDateParts(birthYear, birthMonth, birthDay)) {
    return null;
  }

  const todayYear = todayDate.getUTCFullYear();
  const todayMonth = todayDate.getUTCMonth() + 1;
  const todayDay = todayDate.getUTCDate();
  let age = todayYear - birthYear;

  if (
    todayMonth < birthMonth ||
    (todayMonth === birthMonth && todayDay < birthDay)
  ) {
    age -= 1;
  }

  return Number.isNaN(age) ? null : age;
}

export function inferMinAgeFromDomain(emailDomain: string): number {
  const normalizedDomain = emailDomain.trim().toLowerCase();

  if (normalizedDomain.endsWith(".edu")) {
    return EDU_MIN_AGE;
  }

  return DEFAULT_MIN_AGE;
}

export function isAtLeastRequiredAge(
  birthDate: string,
  requiredMinAge: number,
): boolean {
  const age = calculateAge(birthDate);
  return age !== null && age >= requiredMinAge;
}

export function hasReachedMinimumAge(
  birthDate: string,
  requiredMinAge: number,
  referenceDate: Date = new Date(),
): boolean {
  const birthParts = birthDate.split("-").map(Number);

  if (birthParts.length !== 3) {
    return false;
  }

  const [birthYear, birthMonth, birthDay] = birthParts;
  if (!isValidDateParts(birthYear, birthMonth, birthDay)) {
    return false;
  }

  const threshold = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear() - requiredMinAge,
      referenceDate.getUTCMonth(),
      referenceDate.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  const birth = new Date(Date.UTC(birthYear, birthMonth - 1, birthDay));

  return birth <= threshold;
}
