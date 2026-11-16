import {
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import * as childProcess from "node:child_process";
import * as fs from "node:fs";

import { scopedProcesses } from "../src/utils/processes";

describe.skipIf(process.platform !== "linux")("Linux process discovery", () => {
  beforeEach(() => {
    spyOn(childProcess, "execFileSync")
      .mockReturnValueOnce(
        "43210 chrome --user-data-dir=/tmp/notra-process-discovery/browser\n"
      )
      .mockReturnValue("R\n");
    spyOn(fs, "readlinkSync").mockImplementation(() => {
      throw Object.assign(new Error("Executable mapping is gone"), {
        code: "ENOENT",
      });
    });
    spyOn(process, "kill").mockReturnValue(true);
  });

  afterEach(() => {
    mock.restore();
  });

  test("waits for an exiting process to become a zombie", async () => {
    spyOn(childProcess, "execFileSync")
      .mockReset()
      .mockReturnValueOnce(
        "43210 chrome --user-data-dir=/tmp/notra-process-discovery/browser\n"
      )
      .mockReturnValueOnce("R\n")
      .mockReturnValue("Z\n");

    expect(await scopedProcesses("/tmp/notra-process-discovery")).toEqual([]);
    expect(fs.readlinkSync).toHaveBeenCalledTimes(2);
    expect(process.kill).toHaveBeenCalledWith(43210, 0);
  });

  test("waits for an exiting PID to disappear", async () => {
    spyOn(process, "kill")
      .mockReturnValueOnce(true)
      .mockImplementation(() => {
        throw Object.assign(new Error("Process is gone"), { code: "ESRCH" });
      });

    expect(await scopedProcesses("/tmp/notra-process-discovery")).toEqual([]);
    expect(fs.readlinkSync).toHaveBeenCalledTimes(2);
  });

  test.each(["/usr/bin/chrome", "/usr/bin/editor"])(
    "verifies executable ownership after a transient read failure: %s",
    async (executable) => {
      spyOn(fs, "readlinkSync")
        .mockImplementationOnce(() => {
          throw Object.assign(
            new Error("Executable is temporarily unreadable"),
            {
              code: "ENOENT",
            }
          );
        })
        .mockReturnValue(executable);

      expect(await scopedProcesses("/tmp/notra-process-discovery")).toEqual(
        executable === "/usr/bin/chrome" ? [43210] : []
      );
    }
  );

  test("fails closed for a persistent live, unreadable process", async () => {
    const cause = Object.assign(new Error("Executable access denied"), {
      code: "EACCES",
    });
    spyOn(fs, "readlinkSync").mockImplementation(() => {
      throw cause;
    });
    const kill = spyOn(process, "kill");

    await expect(
      scopedProcesses("/tmp/notra-process-discovery")
    ).rejects.toMatchObject({
      message: "Cannot verify executable for profile-argument candidate 43210",
      cause,
    });
    expect(fs.readlinkSync).toHaveBeenCalled();
    for (const [, signal] of kill.mock.calls) {
      expect(signal).toBe(0);
    }
  });
});
