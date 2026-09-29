# Local Service Verification

Use this reference when a check needs a local dev server, an HTTP probe, a
startup or module-loading measurement, a proxy check, or a browser E2E command.
The project companion and native project configuration remain authoritative.
This reference defines the lifecycle and evidence, not a new project command.

## Discover the contract

Find the service contract in this order:

1. Read the project companion for the start command, URL, readiness path,
   browser command, port policy, timeouts, and thresholds.
2. Read the native project configuration and scripts. Use the existing start and
   E2E scripts verbatim instead of inventing equivalent commands.
3. Inspect dependencies and framework configuration to identify Playwright,
   Cypress, or another browser runner. Do not install or select a runner when
   the project has not configured one.
   If the browser runner already owns a `webServer` or equivalent lifecycle,
   use its configured command, URL, and reuse policy instead of starting a
   second wrapper service.
4. Ask for any missing business-specific URL, expected status, or performance
   threshold. Do not infer those values from a framework default.

Projects may document the following semantic fields without adopting a new file
format:

| Field | Meaning |
| --- | --- |
| `startCommand` | Existing project command that starts the service |
| `baseUrl` | Address used for readiness and the test |
| `readyPath` | Endpoint that proves the service is ready |
| `readyStatus` | Expected HTTP status for readiness |
| `startupTimeout` | Maximum time to wait for readiness |
| `requestTimeout` | Maximum time for one probe |
| `performanceThreshold` | Optional startup or request limit |
| `reuseExistingServer` | Whether a healthy matching service may be reused |
| `portPolicy` | Fixed, project-managed dynamic, or isolated port behavior |
| `logPath` | Location for captured service output |
| `e2eCommand` | Existing browser test command, when applicable |

Operational defaults may be used for startup and request timeouts when the
project does not specify them. Record that a default was used. A readiness
endpoint, expected status, and business performance threshold are required
when the corresponding assertion is requested.

## Run one service lifecycle

Treat discovery, reuse, start, readiness, verification, reporting, and cleanup
as one lifecycle:

1. Resolve the configured URL, readiness path, expected status, port policy,
   timeout, threshold, and log path.
2. Before starting anything, probe the configured readiness URL. If it returns
   the expected status and `reuseExistingServer` permits reuse, mark the service
   as `reused` and leave it running after the check.
3. If the readiness probe fails but the configured port is occupied, report a
   service conflict and fail. Do not terminate or take over the process unless
   project configuration explicitly permits takeover.
4. If no conflicting service exists, run the existing `startCommand` and mark
   the resulting process or job as `startedByRun`.
5. Poll the readiness URL until it returns the expected status or the startup
   timeout expires. A fixed sleep is only a small backoff; it is not proof of
   readiness.
6. Run the configured HTTP, startup, module-loading, proxy, or browser check.
   A browser E2E check starts only after service readiness and uses the
   repository's existing browser workflow.
7. Fail on a configured status, request, or performance violation. If an
   existing service was reused, report that cold-start performance was not
   measured. A cold-start check must explicitly disable reuse and provide an
   isolated or otherwise valid port strategy.
8. In every outcome, clean up only resources marked `startedByRun`. Preserve a
   pre-existing service. Report cleanup failures without replacing the original
   failure reason; a cleanup failure also makes an otherwise passing run fail.

The result must distinguish at least `reused`, `started`, `not-ready`,
`conflict`, `threshold-failed`, `passed`, and `cleanup-failed`. Return a nonzero
result for startup failure, readiness timeout, assertion failure, service
conflict, or cleanup failure.

## Command and port safety

- Prefer the project's existing script and pass arguments through its supported
  interface. Do not rebuild a command by concatenating URL, port, or threshold
  values into an untrusted shell string.
- Bind a local service to `127.0.0.1` when the project supports it. Follow the
  project's configured host and port when it does not.
- Use a configured fixed port for reproducible checks. Use a dynamic or isolated
  port only when the project configuration supports it and the resulting URL is
  passed to every dependent check.
- Treat an occupied fixed port with a failed readiness probe as a conflict.
  Never silently switch ports or kill an unknown process.
- Capture service stdout and stderr to the configured log path. Report the path
  on failure and include only relevant excerpts in the final report.

## PowerShell template

Replace the static script block, URL, status, port, timeouts, threshold, and log
path with values discovered from the project. Keep the `finally` cleanup and the
ownership distinction. This template uses `Start-Job` for a same-session check;
use `Start-Process` only when the project requires an independent process or
child-process-tree control.

```powershell
$job = $null
$startedByRun = $false
$logPath = Join-Path $PWD "artifacts\local-service.log"
$exitCode = 0
$cleanupFailed = $false

try {
    $readyUrl = "http://127.0.0.1:4181/health"
    $readyStatus = "200"
    $reuseExistingServer = $true
    $probe = curl.exe --max-time 2 -sS -o NUL -w "%{http_code}" $readyUrl

    if ($probe -eq $readyStatus -and $reuseExistingServer) {
        Write-Output "service=reused"
    } elseif (Test-NetConnection -ComputerName 127.0.0.1 -Port 4181 -InformationLevel Quiet) {
        throw "Service conflict: port 4181 is occupied but readiness failed"
    } else {
        $job = Start-Job -ScriptBlock {
            npm run dev:local -- --host 127.0.0.1 --port 4181 --open false
        }
        $startedByRun = $true
        $deadline = (Get-Date).AddSeconds(60)
        $ready = $false

        do {
            Start-Sleep -Milliseconds 250
            $probe = curl.exe --max-time 2 -sS -o NUL -w "%{http_code}" $readyUrl
            $ready = $probe -eq $readyStatus
        } while (-not $ready -and (Get-Date) -lt $deadline)

        if (-not $ready) {
            throw "Service did not become ready before the startup timeout"
        }
        Write-Output "service=started"
    }

    # Run the configured HTTP or browser check here and enforce its threshold.
} catch {
    $exitCode = 1
    Write-Error $_
} finally {
    if ($startedByRun -and $null -ne $job) {
        try {
            Stop-Job -Job $job -ErrorAction Stop
            Receive-Job -Job $job -ErrorAction Stop 2>&1 |
                Out-File -FilePath $logPath -Append -ErrorAction Stop
            Remove-Job -Job $job -ErrorAction Stop
        } catch {
            $cleanupFailed = $true
            Write-Error "Service cleanup failed: $_"
        }
    }
}

if ($cleanupFailed) {
    $exitCode = 1
}
exit $exitCode
```

The readiness probe must use the configured status rather than assuming `200`.
The example's `200`, port, URL, and timeout are placeholders, not defaults for
the project.

## Bash lifecycle sketch

Use the same ownership rules on Unix-like systems. The exact port check and
project command come from the repository.

```bash
set -u
pid=""
started_by_run=0
reuse_existing_server=1
cleanup_failed=0
log_path="artifacts/local-service.log"
ready_url="http://127.0.0.1:4181/health"

cleanup() {
  status=$?
  trap - EXIT INT TERM
  if [ "$started_by_run" -eq 1 ] && [ -n "$pid" ]; then
    if kill "$pid" 2>/dev/null; then
      wait "$pid" 2>/dev/null || cleanup_failed=1
    elif kill -0 "$pid" 2>/dev/null; then
      cleanup_failed=1
    fi
  fi
  if [ "$cleanup_failed" -eq 1 ]; then
    status=1
  fi
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [ "$reuse_existing_server" -eq 1 ] && curl --fail --silent --show-error --max-time 2 "$ready_url" >/dev/null; then
  echo "service=reused"
else
  if [ "$reuse_existing_server" -eq 0 ] && curl --fail --silent --show-error --max-time 2 "$ready_url" >/dev/null; then
    echo "service=conflict" >&2
    exit 1
  fi
  if command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 4181; then
    echo "service=conflict" >&2
    exit 1
  fi
  npm run dev:local -- --host 127.0.0.1 --port 4181 --open false >"$log_path" 2>&1 &
  pid=$!
  started_by_run=1
  deadline=$((SECONDS + 60))
  until curl --fail --silent --show-error --max-time 2 "$ready_url" >/dev/null; do
    [ "$SECONDS" -lt "$deadline" ] || { echo "service=not-ready" >&2; exit 1; }
    sleep 0.25
  done
  echo "service=started"
fi

# Run the configured HTTP or browser check and enforce its threshold here.
```

## Evidence report

Record the command, service URL, readiness URL and status, whether the service
was reused or started, startup and request timings, configured and applied
thresholds, E2E runner and command when used, log path, cleanup result, and
unmeasured or unverified scopes. Report commands that were not applicable.
