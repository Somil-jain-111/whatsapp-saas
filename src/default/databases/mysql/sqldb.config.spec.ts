import { AppConfigService } from "../../config/config.service";
import { sqlDbConfig } from "./sqldb.config";

const config = (dbType: "mysql" | "postgres") =>
  ({
    get: (key: string) => (key === "DB_TYPE" ? dbType : undefined),
  }) as AppConfigService;

describe("sqlDbConfig", () => {
  it("does not register PostgreSQL-only module entities for MySQL", () => {
    const options = sqlDbConfig(config("mysql"));

    expect(options.type).toBe("mysql");
    expect(options.entities).toEqual([
      expect.stringContaining("/default/common/entities/**/*.entity"),
    ]);
  });

  it("registers module entities for PostgreSQL", () => {
    const options = sqlDbConfig(config("postgres"));

    expect(options.type).toBe("postgres");
    expect(options.entities).toEqual(
      expect.arrayContaining([
        expect.stringContaining("/modules/**/*.entity"),
        expect.stringContaining("/modules/**/*.entities"),
      ]),
    );
  });
});
