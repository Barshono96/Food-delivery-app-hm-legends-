import { Test, TestingModule } from '@nestjs/testing';
import { ManageBranchController } from './manage_branch.controller';
import { ManageBranchService } from './manage_branch.service';

describe('ManageBranchController', () => {
  let controller: ManageBranchController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ManageBranchController],
      providers: [ManageBranchService],
    }).compile();

    controller = module.get<ManageBranchController>(ManageBranchController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
