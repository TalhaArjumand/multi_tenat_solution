#!/bin/bash
# Fix AppSync auth resolvers for public invitation queries
# Run this after every `amplify push api` to restore the correct auth VTL templates
#
# The Amplify GraphQL Transformer generates a broken unauthRole exact-match check
# for @auth(rules: [{ allow: public, provider: iam }]) queries. This script replaces
# the auth function VTL to allow any IAM-authenticated caller, which is safe because
# these queries only return/modify data scoped by invitation token.

set -e

# Auto-detect region from Amplify team-provider-info or AWS config
REGION="${AWS_REGION:-us-east-1}"

# Auto-detect API ID from Amplify metadata
AMPLIFY_META="amplify/backend/amplify-meta.json"
if [ -f "$AMPLIFY_META" ]; then
  API_ID=$(cat "$AMPLIFY_META" | python3 -c "import sys,json; meta=json.load(sys.stdin); apis=meta.get('api',{}); print(list(apis.values())[0]['output']['GraphQLAPIIdOutput'])" 2>/dev/null || echo "")
fi

# Fallback: try to find it via AWS CLI
if [ -z "$API_ID" ]; then
  API_ID=$(aws appsync list-graphql-apis --region "$REGION" \
    --query "graphqlApis[?name=='team'].apiId" --output text 2>/dev/null || echo "")
fi

if [ -z "$API_ID" ]; then
  echo "ERROR: Could not determine AppSync API ID. Set it manually:"
  echo "  API_ID=your-api-id ./scripts/fix-appsync-auth-resolvers.sh"
  exit 1
fi

echo "Using API ID: $API_ID in region: $REGION"

AUTH_VTL='## [Start] Field Authorization Steps. **
#set( $isAuthorized = false )
#if( $util.authType() == "IAM Authorization" )
  #set( $isAuthorized = true )
#end
#if( $util.authType() == "User Pool Authorization" )
  #set( $isAuthorized = true )
#end
#if( !$isAuthorized )
$util.unauthorized()
#end
$util.toJson({"version":"2018-05-29","payload":{}})
## [End] Field Authorization Steps. **'

RESP_VTL='$util.toJson({})'

PUBLIC_FIELDS=("getInvitationDetails" "approveInvitation" "rejectInvitation")

for FIELD in "${PUBLIC_FIELDS[@]}"; do
  echo ""
  echo "Processing: $FIELD"

  # Get the first pipeline function ID (the auth function)
  FUNC_ID=$(aws appsync list-resolvers \
    --api-id "$API_ID" \
    --type-name Query \
    --region "$REGION" \
    --query "resolvers[?fieldName=='${FIELD}'].pipelineConfig.functions[0]" --output text 2>/dev/null)

  if [ -z "$FUNC_ID" ] || [ "$FUNC_ID" == "None" ]; then
    echo "  WARNING: No resolver found for $FIELD — skipping"
    continue
  fi

  # Get the current function name
  FUNC_NAME=$(aws appsync get-function \
    --api-id "$API_ID" \
    --function-id "$FUNC_ID" \
    --region "$REGION" \
    --query "functionConfiguration.name" --output text)

  echo "  Updating function: $FUNC_NAME ($FUNC_ID)"

  aws appsync update-function \
    --api-id "$API_ID" \
    --function-id "$FUNC_ID" \
    --name "$FUNC_NAME" \
    --data-source-name "NONE_DS" \
    --function-version "2018-05-29" \
    --request-mapping-template "$AUTH_VTL" \
    --response-mapping-template "$RESP_VTL" \
    --region "$REGION"

  echo "  ✅ Done"
done

echo ""
echo "All public invitation auth resolvers updated successfully!"
echo "Test: Open the customer approval page in an incognito browser window."
