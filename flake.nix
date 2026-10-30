{
  description = "Dev environment for proyecto CARMEL: React/Vite frontend + Express/Sequelize API with MariaDB";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      forAllSystems = nixpkgs.lib.genAttrs [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];
    in
    {
      devShells = forAllSystems (system:
        let
          pkgs = import nixpkgs { inherit system; };

          db-start = pkgs.writeShellScriptBin "db-start" ''
            set -euo pipefail

            ROOT="$PWD"
            while [ "$ROOT" != "/" ] && [ ! -f "$ROOT/CARMEL_API/database.sql" ]; do
              ROOT="$(dirname "$ROOT")"
            done
            if [ ! -f "$ROOT/CARMEL_API/database.sql" ]; then
              echo "ERROR: could not find CARMEL_API/database.sql from $PWD" >&2
              exit 1
            fi

            DEVDB="$ROOT/.devdb"
            DATADIR="$DEVDB/mariadb"
            SOCKET="$DEVDB/mysqld.sock"
            PORT="''${DB_PORT:-$(sed -n 's/^DB_PORT=//p' "$ROOT/CARMEL_API/.env" 2>/dev/null | head -1)}"
            PORT="''${PORT:-3306}"
            LOG="$DEVDB/mariadbd.log"

            DB_PASSWORD="$(sed -n 's/^DB_PASSWORD=//p' "$ROOT/CARMEL_API/.env" 2>/dev/null | head -1 | tr -d '"')"
            AUTH=""   # password that currently works on the server, discovered below
            CONNECT=()

            echo "==> Target: 127.0.0.1:$PORT (root password from CARMEL_API/.env: ''${DB_PASSWORD:+set})"

            if [ -S "$SOCKET" ] \
                && MYSQL_PWD="$DB_PASSWORD" mariadb --socket="$SOCKET" -u root \
                   --connect-timeout=3 -e "SELECT 1;" >/dev/null 2>&1; then
              echo "==> Local MariaDB already running (socket: $SOCKET)"
              CONNECT=(--socket="$SOCKET")
              AUTH="$DB_PASSWORD"
            elif [ -S "$SOCKET" ] \
                && MYSQL_PWD="" mariadb --socket="$SOCKET" -u root \
                   --connect-timeout=3 -e "SELECT 1;" >/dev/null 2>&1; then
              echo "==> Local MariaDB already running (socket: $SOCKET, empty root password)"
              CONNECT=(--socket="$SOCKET")
              AUTH=""
            elif MYSQL_PWD="$DB_PASSWORD" mariadb --host=127.0.0.1 --port="$PORT" -u root \
                --connect-timeout=3 -e "SELECT 1;" >/dev/null 2>&1; then
              echo "==> Using existing MySQL/MariaDB already listening on 127.0.0.1:$PORT"
              CONNECT=(--host=127.0.0.1 --port="$PORT")
              AUTH="$DB_PASSWORD"
            elif MYSQL_PWD="" mariadb --host=127.0.0.1 --port="$PORT" -u root \
                --connect-timeout=3 -e "SELECT 1;" >/dev/null 2>&1; then
              echo "==> Found server on 127.0.0.1:$PORT with empty root password"
              CONNECT=(--host=127.0.0.1 --port="$PORT")
              AUTH=""
            else
              if (exec 3<>"/dev/tcp/127.0.0.1/$PORT") 2>/dev/null; then
                exec 3>&- 3<&- || true
                echo "ERROR: 127.0.0.1:$PORT is in use by a process we cannot authenticate to" >&2
                echo "       as root with the configured or empty password." >&2
                echo "       Stop it, or pick another port, e.g.:" >&2
                echo "         DB_PORT=3307 db-start   (then set DB_PORT=3307 in CARMEL_API/.env)" >&2
                exit 1
              fi

              if [ ! -d "$DATADIR/mysql" ]; then
                echo "==> Initializing MariaDB data directory at $DATADIR"
                mariadb-install-db --auth-root-authentication-method=normal \
                  --datadir="$DATADIR" >/dev/null
              fi

              echo "==> Starting MariaDB on 127.0.0.1:$PORT (socket: $SOCKET)"
              mariadbd --no-defaults \
                --datadir="$DATADIR" \
                --socket="$SOCKET" \
                --port="$PORT" \
                --bind-address=127.0.0.1 \
                --skip-name-resolve \
                --pid-file="$DEVDB/mariadbd.pid" \
                >>"$LOG" 2>&1 &

              for _ in $(seq 1 60); do
                if MYSQL_PWD="" mariadb --socket="$SOCKET" -u root \
                    --connect-timeout=1 -e "SELECT 1;" >/dev/null 2>&1; then
                  break
                fi
                sleep 0.5
              done

              if ! MYSQL_PWD="" mariadb --socket="$SOCKET" -u root \
                  --connect-timeout=3 -e "SELECT 1;" >/dev/null 2>&1; then
                echo "ERROR: MariaDB failed to start, log follows:" >&2
                cat "$LOG" >&2
                exit 1
              fi
              CONNECT=(--socket="$SOCKET")
              AUTH=""
            fi

            if [ "$AUTH" != "$DB_PASSWORD" ]; then
              echo "==> Syncing root password to match CARMEL_API/.env"
              HOSTS="$(MYSQL_PWD="$AUTH" mariadb "''${CONNECT[@]}" -u root -N -e \
                "SELECT Host FROM mysql.user WHERE User = 'root' \
                   AND Host IN ('localhost', '127.0.0.1', '::1');")"
              SQL=""
              for host in $HOSTS; do
                SQL="''${SQL}ALTER USER 'root'@'$host' IDENTIFIED BY \"''${DB_PASSWORD//\'/\'\'}\";"
              done
              MYSQL_PWD="$AUTH" mariadb "''${CONNECT[@]}" -u root -e "$SQL"
            fi

            echo "==> Loading CARMEL_API/database.sql"
            MYSQL_PWD="$DB_PASSWORD" mariadb "''${CONNECT[@]}" -u root \
              < "$ROOT/CARMEL_API/database.sql"

            echo "==> Database 'carmel' ready on 127.0.0.1:$PORT (root, password per CARMEL_API/.env)"
          '';

          db-stop = pkgs.writeShellScriptBin "db-stop" ''
            set -euo pipefail
            ROOT="$PWD"
            while [ "$ROOT" != "/" ] && [ ! -f "$ROOT/CARMEL_API/database.sql" ]; do
              ROOT="$(dirname "$ROOT")"
            done
            SOCKET="$ROOT/.devdb/mysqld.sock"
            DB_PASSWORD="$(sed -n 's/^DB_PASSWORD=//p' "$ROOT/CARMEL_API/.env" 2>/dev/null | head -1 | tr -d '"')"
            if MYSQL_PWD="$DB_PASSWORD" mariadb-admin --socket="$SOCKET" -u root shutdown 2>/dev/null; then
              echo "==> Stopped MariaDB"
            elif MYSQL_PWD="" mariadb-admin --socket="$SOCKET" -u root shutdown 2>/dev/null; then
              echo "==> Stopped MariaDB (empty root password)"
            else
              echo "==> MariaDB is not running"
            fi
          '';

          db-reset = pkgs.writeShellScriptBin "db-reset" ''
            set -euo pipefail
            ROOT="$PWD"
            while [ "$ROOT" != "/" ] && [ ! -f "$ROOT/CARMEL_API/database.sql" ]; do
              ROOT="$(dirname "$ROOT")"
            done
            db-stop
            rm -rf "$ROOT/.devdb"
            db-start
          '';
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              pkgs.mariadb
              db-start
              db-stop
              db-reset
            ];

            shellHook = ''
              for d in CARMEL_API CARMEL_APP; do
                if [ ! -f "$d/.env" ] && [ -f "$d/.env.example" ]; then
                  cp "$d/.env.example" "$d/.env"
                  echo "==> Created $d/.env from $d/.env.example"
                fi
              done

              cat <<'EOF'

              CARMEL development shell

                db-start    start local MariaDB (works from any project subdirectory),
                            syncs root password from CARMEL_API/.env, loads database.sql
                db-stop     stop the local MariaDB
                db-reset    wipe the local database and start fresh

                DB:    db-start            (from repo root; sets DB_PORT in .env if you change ports)
                API:   cd CARMEL_API && npm install && npm run dev
                Seed:  cd CARMEL_API && npm run seed
                App:   cd CARMEL_APP && npm install && npm run dev
              EOF
            '';
          };
        });
    };
}
