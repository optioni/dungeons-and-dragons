import { ArgsType } from '@nestjs/graphql';

import { ConnectionArgs } from '../../graphql/relay/index.js';

@ArgsType()
export class CampaignsConnectionArgs extends ConnectionArgs {}
