#!/bin/bash
# Experiment Results Script
#
# This script stores experiment results in the database for analytics.
# It can be used to persist performance metrics from load tests or A/B tests.
#
# Usage:
#   ./scripts/experiment-results.sh "experiment_name" "variant" "metric_name" value
#
# Example:
#   ./scripts/experiment-results.sh "lru_cache_test" "baseline" "avg_response_time" 234.5

if [ $# -lt 4 ]; then
  echo "Usage: $0 <experiment_name> <variant> <metric_name> <value> [description]"
  echo "Example: $0 lru_cache_test baseline avg_response_time 234.5"
  exit 1
fi

EXPERIMENT_NAME=$1
VARIANT=$2
METRIC=$3
VALUE=$4
DESCRIPTION=${5:-""}

# Create a TypeScript script to insert the experiment result
cat > /tmp/insert_experiment.ts << EOF
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.experiment.create({
    data: {
      name: '${EXPERIMENT_NAME}',
      variant: '${VARIANT}',
      metric: '${METRIC}',
      value: ${VALUE},
      description: '${DESCRIPTION}',
    },
  });

  console.log('Experiment result stored:');
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.\$disconnect();
  });
EOF

# Run the script
npx ts-node /tmp/insert_experiment.ts

# Cleanup
rm /tmp/insert_experiment.ts

echo "Experiment result stored successfully!"

