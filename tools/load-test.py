# -*- coding: utf-8 -*-
"""
Нагрузочная проверка: начало смены на 100 человек.

Сценарий такой же, как в цеху: сто рабочих в одну минуту заходят в систему,
отмечают приход и открывают свои задания. Замеряем время каждого шага.
"""
import base64, json, statistics, sys, threading, time, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = "http://localhost:3000"
ADMIN = ("admin", "password123")
PREFIX = "load."
COUNT = 100
PASSWORD = "belmy-load1"


def call(method, path, token=None, body=None, timeout=60):
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method)
    if data:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            txt = r.read().decode("utf-8")
            return r.status, (json.loads(txt) if txt else None), time.perf_counter() - started
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8"), time.perf_counter() - started
    except Exception as e:  # таймаут, обрыв соединения
        return 0, str(e), time.perf_counter() - started


def admin_token():
    st, body, _ = call("POST", "/auth/login", body={"username": ADMIN[0], "password": ADMIN[1]})
    return body["accessToken"]


def stats(name, samples):
    if not samples:
        print(f"  {name}: нет данных")
        return
    s = sorted(samples)
    p = lambda q: s[min(len(s) - 1, int(len(s) * q))]
    print(
        f"  {name}: median {p(0.5)*1000:6.0f} ms | p95 {p(0.95)*1000:6.0f} ms | "
        f"max {s[-1]*1000:6.0f} ms | n={len(s)}"
    )


def ensure_users(token):
    st, users, _ = call("GET", "/users?withArchived=true", token)
    existing = {u["username"] for u in users if u["username"].startswith(PREFIX)}
    site = next((u["siteId"] for u in users if u.get("siteId")), None)
    todo = [f"{PREFIX}{i:03d}" for i in range(COUNT) if f"{PREFIX}{i:03d}" not in existing]
    if todo:
        print(f"Создаю {len(todo)} тестовых рабочих...")
        for name in todo:
            call("POST", "/users", token, {
                "username": name, "password": PASSWORD, "fullName": f"Нагрузочный {name[-3:]}",
                "role": "WORKER", "siteId": site,
            })
    return [f"{PREFIX}{i:03d}" for i in range(COUNT)]


def start_of_shift(usernames, workers):
    """Все заходят одновременно: логин → приход → мои задания."""
    login_times, checkin_times, tasks_times = [], [], []
    errors = []
    lock = threading.Lock()

    def one(username):
        st, body, dt = call("POST", "/auth/login", body={"username": username, "password": PASSWORD})
        with lock:
            login_times.append(dt)
            if st not in (200, 201):
                errors.append(("login", st, str(body)[:80]))
                return
        token = body["accessToken"]

        st, _, dt = call("POST", "/attendance/check-in", token)
        with lock:
            checkin_times.append(dt)
            if st not in (200, 201, 400):  # 400 = уже отмечен сегодня
                errors.append(("check-in", st, ""))

        st, _, dt = call("GET", "/my-tasks", token)
        with lock:
            tasks_times.append(dt)
            if st != 200:
                errors.append(("my-tasks", st, ""))

    started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(one, usernames))
    total = time.perf_counter() - started

    print(f"\n--- Начало смены: {len(usernames)} человек, {workers} одновременно ---")
    print(f"  Всё заняло: {total:.1f} c")
    stats("логин   ", login_times)
    stats("приход  ", checkin_times)
    stats("задания ", tasks_times)
    if errors:
        print(f"  ОШИБКИ: {len(errors)}")
        for e in errors[:5]:
            print("   ", e)
    else:
        print("  Ошибок нет")
    return total, login_times, errors


def manager_during_load(token_getter, usernames, workers):
    """Пока смена заходит, начальник участка открывает свои экраны."""
    lead_token = None
    st, body, _ = call("POST", "/auth/login", body={"username": "site_lead", "password": "password123"})
    lead_token = body["accessToken"]

    result = {}

    def load_workers():
        def one(username):
            st, body, _ = call("POST", "/auth/login", body={"username": username, "password": PASSWORD})
            if st in (200, 201):
                call("GET", "/my-tasks", body["accessToken"])
        with ThreadPoolExecutor(max_workers=workers) as pool:
            list(pool.map(one, usernames))

    def measure_lead():
        times = []
        deadline = time.perf_counter() + 12
        while time.perf_counter() < deadline:
            _, _, dt = call("GET", "/distribution/summary", lead_token)
            times.append(dt)
            time.sleep(0.3)
        result["lead"] = times

    t1 = threading.Thread(target=load_workers)
    t2 = threading.Thread(target=measure_lead)
    t1.start(); t2.start()
    t1.join(); t2.join()

    print("\n--- Экран начальника участка под нагрузкой ---")
    stats("распределение", result.get("lead", []))


if __name__ == "__main__":
    token = admin_token()
    usernames = ensure_users(token)

    # Прогрев: один заход, чтобы прогрелись коннекты и Prisma.
    call("POST", "/auth/login", body={"username": usernames[0], "password": PASSWORD})

    total, logins, errors = start_of_shift(usernames, workers=int(sys.argv[1]) if len(sys.argv) > 1 else 25)
    manager_during_load(token, usernames[:50], workers=25)

    print("\nВывод:")
    slow = [t for t in logins if t > 3]
    if errors:
        print(f"  Есть ошибки ({len(errors)}) — разбирать до пилота.")
    if slow:
        print(f"  Логин дольше 3 секунд у {len(slow)} человек из {len(logins)}.")
    elif logins:
        print(f"  Самый долгий логин: {max(logins):.1f} c.")
