#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { MecabCdkStack } from '../lib/mecab-cdk-stack';

const app = new cdk.App();
new MecabCdkStack(app, 'MecabCdkStack');
