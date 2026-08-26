<?php

namespace OrderEazi\Commerce\Api\Sdk\Tests\Support;

/**
 * A real local HTTP server (PHP's built-in `php -S`, launched as a subprocess) for the retry tests to hit -
 * not a mocked HTTP client. Serves one status per entry in the given plan (repeating the last entry once
 * exhausted), optionally with a Retry-After header on 429s.
 */
final class MockServer
{
    /** @var resource */
    private $process;

    public readonly string $baseUrl;

    private string $stateFile;

    public static function start(array $statuses, string $retryAfter = '0'): self
    {
        return new self($statuses, $retryAfter);
    }

    private function __construct(array $statuses, string $retryAfter)
    {
        $planFile = tempnam(sys_get_temp_dir(), 'oe_mock_plan_');
        file_put_contents($planFile, json_encode($statuses));

        $this->stateFile = tempnam(sys_get_temp_dir(), 'oe_mock_state_');
        file_put_contents($this->stateFile, '0');

        $router = __DIR__ . '/mock-router.php';
        $env = array_merge($_ENV, [
            'MOCK_PLAN_FILE' => $planFile,
            'MOCK_STATE_FILE' => $this->stateFile,
            'MOCK_RETRY_AFTER' => $retryAfter,
        ]);

        $descriptors = [1 => ['pipe', 'w'], 2 => ['pipe', 'w']];

        $lastError = null;
        for ($attempt = 0; $attempt < 5; $attempt++) {
            $port = random_int(20000, 60000);
            $process = proc_open(
                [PHP_BINARY, '-S', "127.0.0.1:{$port}", $router],
                $descriptors,
                $pipes,
                null,
                $env
            );

            if (!is_resource($process)) {
                $lastError = 'proc_open failed';
                continue;
            }

            if ($this->waitUntilListening($port)) {
                $this->process = $process;
                $this->baseUrl = "http://127.0.0.1:{$port}";
                return;
            }

            proc_terminate($process);
            proc_close($process);
            $lastError = "port {$port} never came up";
        }

        throw new \RuntimeException("Could not start mock server: {$lastError}");
    }

    private function waitUntilListening(int $port): bool
    {
        $deadline = microtime(true) + 3;
        while (microtime(true) < $deadline) {
            $conn = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.1);
            if ($conn) {
                fclose($conn);
                return true;
            }
            usleep(50000);
        }
        return false;
    }

    public function requestCount(): int
    {
        clearstatcache(true, $this->stateFile);
        return (int) file_get_contents($this->stateFile);
    }

    public function stop(): void
    {
        if (is_resource($this->process)) {
            proc_terminate($this->process);
            proc_close($this->process);
        }
    }
}
