import { ArgsType } from '@nestjs/graphql';

import { ConnectionArgs } from '../../graphql/relay';

@ArgsType()
export class CampaignsConnectionArgs extends ConnectionArgs {}
