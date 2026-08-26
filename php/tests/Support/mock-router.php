<?php

/**
 * Router script for PHP's built-in server (php -S). php -S invokes this script fresh for every request -
 * there's no shared in-memory state across requests - so the request count is persisted in MOCK_STATE_FILE
 * instead, guarded by flock() since a client under test may fire requests back-to-back.
 */

$planFile = getenv('MOCK_PLAN_FILE');
$stateFile = getenv('MOCK_STATE_FILE');
$retryAfter = getenv('MOCK_RETRY_AFTER') ?: '0';

$plan = json_decode(file_get_contents($planFile), true);

$handle = fopen($stateFile, 'c+');
flock($handle, LOCK_EX);
$count = (int) fread($handle, 1024);
$index = $count;
$count++;
ftruncate($handle, 0);
rewind($handle);
fwrite($handle, (string) $count);
fflush($handle);
flock($handle, LOCK_UN);
fclose($handle);

$status = $plan[$index] ?? $plan[count($plan) - 1];

http_response_code($status);
if ($status === 429) {
    header("Retry-After: {$retryAfter}");
}
header('Content-Length: 0');
