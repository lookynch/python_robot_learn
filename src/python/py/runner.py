import builtins
import json
import linecache
import math
import random
import sys
import time
import traceback

import lab._core as lab_core

CODE_FILE = "<code>"
TEST_FILE = "<test>"
OUTPUT_LIMIT = 200_000
HIDDEN_NAMES = {"input", "__builtins__", "__name__", "__doc__", "__loader__", "__spec__", "__package__", "__annotations__", "__file__", "__cached__"}


class NeedInput(BaseException):
    pass


class OutputLimit(BaseException):
    pass


class TraceLimit(BaseException):
    pass


class Deadline(BaseException):
    pass


class DeadlineTracer:
    def __init__(self, seconds):
        self.until = time.perf_counter() + seconds
        self.events = 0

    def __call__(self, frame, event, arg):
        if frame.f_code.co_filename not in (CODE_FILE, TEST_FILE):
            return None
        self.events += 1
        if self.events % 2000 == 0 and time.perf_counter() > self.until:
            raise Deadline()
        return self


class Out:
    def __init__(self, emit=None, limit=OUTPUT_LIMIT):
        self.parts = []
        self.size = 0
        self.emit = emit
        self.limit = limit

    def write(self, s):
        if not s:
            return 0
        self.size += len(s)
        if self.size > self.limit:
            raise OutputLimit()
        self.parts.append(s)
        if self.emit is not None:
            self.emit(s)
        return len(s)

    def flush(self):
        pass

    def isatty(self):
        return False

    def text(self):
        return "".join(self.parts)


def safe_repr(value, limit=80):
    try:
        if callable(value) and hasattr(value, "__name__"):
            kind = "Klasse" if isinstance(value, type) else "Funktion"
            return f"<{kind} {value.__name__}>"
        text = repr(value)
    except Exception as e:
        text = f"<repr-Fehler: {type(e).__name__}>"
    text = " ".join(text.split()) if "\n" in text else text
    return text if len(text) <= limit else text[: limit - 1] + "…"


def visible_vars(ns):
    out = {}
    for name, value in ns.items():
        if name in HIDDEN_NAMES or name.startswith("__") or type(value).__name__ == "module":
            continue
        out[name] = safe_repr(value)
    return out


class Tracer:
    def __init__(self, max_steps, out):
        self.max_steps = max_steps
        self.out = out
        self.steps = []

    def snapshot(self, frame, event):
        stack = []
        f = frame
        while f is not None and f.f_code.co_filename == CODE_FILE:
            name = f.f_code.co_name
            stack.append({"name": "global" if name == "<module>" else name, "vars": visible_vars(f.f_locals)})
            f = f.f_back
        stack.reverse()
        self.steps.append({"line": frame.f_lineno, "event": event, "stack": stack, "out": self.out.size})
        if len(self.steps) >= self.max_steps:
            raise TraceLimit()

    def __call__(self, frame, event, arg):
        if frame.f_code.co_filename != CODE_FILE:
            return None
        if event == "line" or (event == "return" and frame.f_code.co_name != "<module>"):
            self.snapshot(frame, event)
        return self


def error_info(exc, code):
    if isinstance(exc, SyntaxError) and exc.filename == CODE_FILE:
        line = exc.lineno
        formatted = "".join(traceback.format_exception_only(type(exc), exc))
    else:
        te = traceback.TracebackException.from_exception(exc)
        frames = [f for f in te.stack if f.filename == CODE_FILE]
        line = frames[-1].lineno if frames else None
        te.stack = traceback.StackSummary.from_list(frames)
        formatted = "".join(te.format())
    return {
        "type": type(exc).__name__,
        "message": exc.msg if isinstance(exc, SyntaxError) else str(exc),
        "line": line,
        "traceback": formatted.replace(f'File "{CODE_FILE}"', "Datei <dein Code>"),
    }


def make_input(queue, out):
    def fake_input(prompt=""):
        out.write(str(prompt))
        if not queue:
            raise NeedInput()
        value = queue.pop(0)
        out.write(value + "\n")
        return value

    return fake_input


def seed_everything(seed):
    random.seed(seed)
    if "numpy" in sys.modules:
        sys.modules["numpy"].random.seed(seed % (2 ** 32))


def close(a, b, tol=1e-6):
    if "numpy" in sys.modules:
        np = sys.modules["numpy"]
        return bool(np.allclose(np.asarray(a, dtype=float), np.asarray(b, dtype=float), atol=tol, rtol=0))
    return math.isclose(float(a), float(b), abs_tol=tol)


def run_tests(tests, ns, main_output, seed, deadline=None):
    results = []
    for test in tests:
        sink = Out(limit=OUTPUT_LIMIT)
        sys.stdout = sys.stderr = sink
        test_ns = ns
        test_ns["output"] = lambda: main_output
        test_ns["lines"] = lambda: [l.rstrip() for l in main_output.rstrip("\n").split("\n")] if main_output else []
        test_ns["close"] = close
        test_ns["scenes"] = lambda: list(lab_core.scenes)
        seed_everything(seed)
        try:
            if deadline:
                sys.settrace(deadline)
            exec(compile(test["code"], TEST_FILE, "exec"), test_ns)
            results.append({"name": test["name"], "passed": True, "message": None})
        except Deadline:
            results.append({"name": test["name"], "passed": False, "message": "Zeitlimit überschritten (Endlosschleife?)."})
        except AssertionError as e:
            results.append({"name": test["name"], "passed": False, "message": str(e) or "Bedingung nicht erfüllt."})
        except NeedInput:
            results.append({"name": test["name"], "passed": False, "message": "Der Test brauchte mehr Eingaben als vorgesehen."})
        except Exception as e:
            results.append({"name": test["name"], "passed": False, "message": f"{type(e).__name__}: {e}"})
        finally:
            sys.settrace(None)
            for helper in ("output", "lines", "close", "scenes"):
                test_ns.pop(helper, None)
    return results


def run(request_json, emit_out=None, emit_err=None, emit_progress=None):
    req = json.loads(request_json)
    code = req["code"]
    queue = list(req.get("stdin") or [])
    seed = int(req.get("seed") or 0)
    tests = req.get("tests") or []
    trace_steps = req.get("trace")

    out = Out(emit_out)
    err = Out(emit_err)
    lab_core.reset()
    lab_core.hooks["progress"] = emit_progress
    linecache.cache[CODE_FILE] = (len(code), None, code.splitlines(True), CODE_FILE)
    if "numpy" in code or "envs" in code:
        import numpy  # noqa: F401
    ns = {"__name__": "__main__", "__builtins__": builtins, "input": make_input(queue, out)}
    tracer = Tracer(int(trace_steps), out) if trace_steps else None
    deadline = DeadlineTracer(float(req["deadline"])) if req.get("deadline") and not tracer else None
    result = {"status": "ok", "error": None}
    saved = sys.stdout, sys.stderr
    sys.stdout, sys.stderr = out, err
    seed_everything(seed)
    started = time.perf_counter()
    try:
        compiled = compile(code, CODE_FILE, "exec")
        if tracer or deadline:
            sys.settrace(tracer or deadline)
        exec(compiled, ns)
    except NeedInput:
        result["status"] = "needs_input"
    except OutputLimit:
        result["status"] = "output_limit"
    except TraceLimit:
        result["status"] = "trace_limit"
    except Deadline:
        result["status"] = "timeout"
    except SystemExit:
        pass
    except BaseException as exc:
        result["status"] = "error"
        result["error"] = error_info(exc, code)
    finally:
        sys.settrace(None)
        sys.stdout, sys.stderr = saved
    result["seconds"] = round(time.perf_counter() - started, 4)
    if tracer:
        if result["status"] in ("ok", "trace_limit"):
            tracer.steps.append({"line": None, "event": "end", "stack": [{"name": "global", "vars": visible_vars(ns)}], "out": out.size})
        result["trace"] = tracer.steps
    result["inputsUsed"] = len(req.get("stdin") or []) - len(queue)
    result["stdout"] = out.text()
    result["stderr"] = err.text()
    if tests:
        if result["status"] == "ok":
            try:
                result["tests"] = run_tests(tests, ns, result["stdout"], seed, deadline)
            finally:
                sys.stdout, sys.stderr = saved
        else:
            reason = {
                "error": "Dein Programm ist mit einem Fehler abgebrochen – die Tests konnten nicht laufen.",
                "needs_input": "Dein Programm wollte mehr Eingaben, als die Aufgabe vorsieht.",
                "output_limit": "Dein Programm hat zu viel ausgegeben.",
                "timeout": "Zeitlimit überschritten (Endlosschleife?).",
            }.get(result["status"], "Die Tests konnten nicht laufen.")
            result["tests"] = [{"name": t["name"], "passed": False, "message": reason} for t in tests]
    result["scenes"] = list(lab_core.scenes)
    lab_core.hooks["progress"] = None
    return json.dumps(result, allow_nan=False, default=str)
