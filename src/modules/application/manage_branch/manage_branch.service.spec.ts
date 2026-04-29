import { Test, TestingModule } from '@nestjs/testing';
import { ManageBranchService } from './manage_branch.service';

describe('ManageBranchService', () => {
  let service: ManageBranchService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ManageBranchService],
    }).compile();

    service = module.get<ManageBranchService>(ManageBranchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
