#!/bin/bash
# bash database.sh -m     : Create database and user, and insert sample data for testing
# bash database.sh         : Create database and user without inserting sample data

echo "Checking if PostgreSQL container is ready..."
until docker exec pg-oos_detection pg_isready -U oos_detection > /dev/null 2>&1; do
    if ! docker ps -q -f name=pg-oos_detection | grep -q .; then
        echo "Error: Container pg-oos_detection is not running."
        exit 1
    fi
    sleep 1
done

echo "Creating database and user to docker container..."
docker cp ./scripts/data.sql pg-oos_detection:/data.sql
docker exec -it pg-oos_detection psql -U oos_detection -d oos_detection -f data.sql

if [[ "$1" == "-m" ]]; then
    echo "Creating sample data for testing..."
    docker cp ./scripts/sample_data.sql pg-oos_detection:/sample_data.sql
    docker exec -it pg-oos_detection psql -U oos_detection -d oos_detection -f sample_data.sql
fi