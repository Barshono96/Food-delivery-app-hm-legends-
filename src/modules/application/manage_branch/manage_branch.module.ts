import { Module } from '@nestjs/common';
import { ManageBranchService } from './manage_branch.service';
import { ManageBranchController } from './manage_branch.controller';

@Module({
  controllers: [ManageBranchController],
  providers: [ManageBranchService],
})
export class ManageBranchModule {}
