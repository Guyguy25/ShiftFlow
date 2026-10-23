import {canManageOperations} from './permissions';
test.each([['owner','business',true],['admin','business',true],['member','business',false],['admin','team',false],['member','team',true]])('%s on %s operational permissions', (role,tier,allowed)=>{expect(canManageOperations({organization:{role},subscription_tier:tier})).toBe(allowed);});
