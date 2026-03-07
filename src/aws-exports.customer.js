/* eslint-disable */
// Customer portal auth config snapshot. Keep in source control to avoid generated-config drift.

const awsmobile = {
    "aws_project_region": "us-east-1",
    "aws_appsync_graphqlEndpoint": "https://dpbooagcbrcrrfjlwgxwszuh34.appsync-api.us-east-1.amazonaws.com/graphql",
    "aws_appsync_region": "us-east-1",
    "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS",
    "aws_cognito_identity_pool_id": "us-east-1:3001ba3a-5f07-4c36-9bfa-c2aac885f884",
    "aws_cognito_region": "us-east-1",
    "aws_user_pools_id": "us-east-1_GyQq313qC",
    "aws_user_pools_web_client_id": "57n8njdqivsd80pbn27e5s42ks",
    "oauth": {
        "domain": "d13k6ou0ossrku-main.auth.us-east-1.amazoncognito.com",
        "scope": [
            "email",
            "openid",
            "profile"
        ],
        "redirectSignIn": "https://main.d13k6ou0ossrku.amplifyapp.com/customer",
        "redirectSignOut": "https://main.d13k6ou0ossrku.amplifyapp.com/customer",
        "responseType": "code"
    },
    "federationTarget": "COGNITO_USER_POOLS",
    "aws_cognito_username_attributes": [
        "EMAIL"
    ],
    "aws_cognito_social_providers": [],
    "aws_cognito_signup_attributes": [
        "EMAIL"
    ],
    "aws_cognito_mfa_configuration": "OFF",
    "aws_cognito_mfa_types": [
        "SMS"
    ],
    "aws_cognito_password_protection_settings": {
        "passwordPolicyMinLength": 8,
        "passwordPolicyCharacters": []
    },
    "aws_cognito_verification_mechanisms": [
        "EMAIL"
    ]
};

export default awsmobile;
