import React, { useState, useEffect, useCallback, Fragment } from 'react';
import { ethers } from 'ethers';

// Import the same contract artifacts as before
import SkillChainArtifact from './contracts/SkillChain.json';
import contractAddressInfo from './contracts/contract-address.json';

// --- Enhanced Icons (with more detail and consistency) ---

const IconWallet = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;
const IconChain = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-indigo-400"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"/></svg>;
const IconCheckCircle = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 mr-2 text-emerald-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="9 11 12 14 22 4"></polyline></svg>;
const Spinner = () => <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>;
const IconStar = ({ isFilled, isHovering, onHover, onClick }) => (
    <svg 
        onMouseEnter={onHover}
        onClick={onClick}
        className={`w-8 h-8 cursor-pointer transition-colors ${isFilled ? 'text-yellow-400' : isHovering ? 'text-yellow-300' : 'text-slate-600'}`} 
        fill="currentColor" 
        viewBox="0 0 20 20">
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
    </svg>
);


// --- Helper Components ---

const StatusPill = ({ status }) => {
    const statusMap = {
        0: { text: 'Open', style: 'bg-gray-700 text-gray-300' },
        1: { text: 'Funded', style: 'bg-blue-900 text-blue-300 border border-blue-500/50' },
        2: { text: 'Submitted', style: 'bg-yellow-900 text-yellow-300 border border-yellow-500/50 animate-pulse' },
        3: { text: 'Completed', style: 'bg-emerald-900 text-emerald-300 border border-emerald-500/50' },
        4: { text: 'Canceled', style: 'bg-red-900 text-red-300 border border-red-500/50' },
    };
    const { text, style } = statusMap[status] || statusMap[0];
    return <span className={`px-3 py-1 text-xs font-medium rounded-full ${style}`}>{text}</span>;
};

const AnimatedBackground = () => (
    <div className="fixed top-0 left-0 w-full h-full -z-50 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-slate-900"></div>
        <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-radial from-slate-900 via-indigo-950/40 to-slate-900 animate-pan-background"></div>
    </div>
);

// --- Main App Component ---
export default function App() {
    // --- State Variables ---
    const [page, setPage] = useState('feed');
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [walletAddress, setWalletAddress] = useState(null);
    const [provider, setProvider] = useState(null);
    const [contract, setContract] = useState(null);
    const [signer, setSigner] = useState(null);
    const [skills, setSkills] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [userProfile, setUserProfile] = useState(null);
    const [walletBalance, setWalletBalance] = useState(null);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false); // State for modal
    const [reviewJob, setReviewJob] = useState(null); // State to hold job being reviewed

    // --- Core Logic ---
    const formatSkill = (skill) => ({ id: Number(skill.id), provider: skill.provider, title: skill.title, description: skill.description, rate: ethers.formatEther(skill.rate), isActive: skill.isActive });
    const formatJob = (job) => ({ id: Number(job.id), client: job.client, provider: job.provider, skillId: Number(job.skillId), amount: ethers.formatEther(job.amount), status: Number(job.status), ipfsDetailsHash: job.ipfsDetailsHash });
    const handleError = (error, defaultMessage = "An error occurred.") => { console.error(error); const message = error?.revert?.args[0] || error?.data?.message || error.message || defaultMessage; setErrorMessage(message.slice(0, 150) + '...'); };
    const fetchAllSkills = useCallback(async (currentContract) => { try { const allSkills = await currentContract.getAllSkills(); setSkills(allSkills.map(formatSkill)); } catch (error) { handleError(error, "Failed to fetch skills."); } }, []);
    
    const fetchUserData = useCallback(async (currentContract, currentAddress, currentProvider) => {
        if (!currentContract || !currentAddress || !currentProvider) return;
        try {
            const profile = await currentContract.getProfile(currentAddress);
            setUserProfile(profile.wallet !== ethers.ZeroAddress ? profile : null);
            const userJobs = await currentContract.getAllJobsForUser(currentAddress);
            setJobs(userJobs.map(formatJob));
            const balance = await currentProvider.getBalance(currentAddress);
            setWalletBalance(ethers.formatEther(balance));
        } catch (error) { handleError(error, "Failed to fetch user data."); }
    }, []);

    useEffect(() => { const init = async () => { if (window.ethereum) { try { const newProvider = new ethers.BrowserProvider(window.ethereum); setProvider(newProvider); const newContract = new ethers.Contract(contractAddressInfo.address, SkillChainArtifact.abi, newProvider); setContract(newContract); fetchAllSkills(newContract); window.ethereum.on('accountsChanged', (accounts) => { setWalletAddress(accounts[0] || null); }); } catch (error) { handleError(error, "Initialization failed."); } } else { console.log('Please install MetaMask!'); } }; init(); }, [fetchAllSkills]);
    
    useEffect(() => { const handleAccountChange = async () => { if (walletAddress && provider && contract) { const newSigner = await provider.getSigner(); setSigner(newSigner); fetchUserData(contract, walletAddress, provider); } else { setSigner(null); setUserProfile(null); setJobs([]); setWalletBalance(null); } }; handleAccountChange(); }, [walletAddress, provider, contract, fetchUserData]);

    const connectWallet = async () => { if (!provider) return; try { const accounts = await provider.send("eth_requestAccounts", []); setWalletAddress(accounts[0] || null); } catch (error) { handleError(error, "Failed to connect wallet."); } };
    
    const runTransaction = async (func) => { setIsLoading(true); setErrorMessage(''); try { const tx = await func(); await tx.wait(); await fetchAllSkills(contract); await fetchUserData(contract, walletAddress, provider); } catch (error) { handleError(error); } finally { setIsLoading(false); } };
    
    const createProfile = async (name, bio) => { await runTransaction(() => contract.connect(signer).createOrUpdateProfile(name, bio, "ipfs_placeholder")); };
    const listNewSkill = async (title, description, rate) => { const rateInWei = ethers.parseEther(rate); await runTransaction(() => contract.connect(signer).listSkill(title, description, rateInWei)); };
    const hireProvider = async (skill) => { const rateInWei = ethers.parseEther(skill.rate.toString()); await runTransaction(() => contract.connect(signer).createJob(skill.id, "ipfs-hash-placeholder", { value: rateInWei })); };
    const submitWorkForJob = async (jobId) => { await runTransaction(() => contract.connect(signer).submitWork(jobId)); };
    const confirmJobCompletion = async (jobId) => { await runTransaction(() => contract.connect(signer).confirmCompletion(jobId)); };
    
    // NEW function to leave a review
    const leaveReview = async (jobId, rating, comment) => {
        await runTransaction(() => contract.connect(signer).leaveReview(jobId, rating, comment));
        setIsReviewModalOpen(false); // Close modal on success
    };

    // --- UI Components ---
    const GlassCard = ({ children, className = '', ...props }) => <div className={`bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-lg transition-all duration-300 ${className}`} {...props}>{children}</div>;
    const PageContainer = ({ children, key }) => <div key={key} className="animate-fade-in-up">{children}</div>;

    const Header = () => (
        <header className="fixed top-0 left-0 w-full z-40 bg-slate-900/60 backdrop-blur-lg border-b border-slate-700/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setPage('feed')}><IconChain /><h1 className="text-2xl font-bold text-slate-100">SkillSwap</h1></div>
                    <nav className="hidden md:flex items-center space-x-2 bg-slate-800/50 border border-slate-700 rounded-full px-2 py-1">
                       {['feed', 'dashboard', 'profile', 'about'].map(p => (<button key={p} onClick={() => setPage(p)} className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${page === p ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700/50'}`}>{p.charAt(0).toUpperCase() + p.slice(1)}</button>))}
                    </nav>
                    <div>{walletAddress ? (<div className="flex items-center bg-slate-800/50 border border-slate-700 px-4 py-2 rounded-full text-slate-300 space-x-4"><div className="font-mono text-sm text-emerald-400">{walletBalance ? `Ξ ${parseFloat(walletBalance).toFixed(4)}` : '...'}</div><div className="flex items-center"><IconCheckCircle /><span className="font-mono text-sm">{`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`}</span></div></div>) : (<button onClick={connectWallet} disabled={isLoading} className="inline-flex items-center px-4 py-2 text-base font-medium rounded-full text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/50 disabled:bg-slate-600 disabled:shadow-none">{isLoading ? <Spinner/> : <IconWallet />} Connect Wallet</button>)}</div>
                </div>
            </div>
        </header>
    );
    
    const AboutPage = () => (
        <PageContainer key="about">
            <div className="text-center mb-16"><h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-4">Reimagining Trust in Work</h1><p className="max-w-3xl mx-auto text-lg text-slate-400">SkillSwap leverages blockchain to create a fair, transparent, and secure platform for freelancers and clients worldwide.</p></div>
            <div className="grid md:grid-cols-2 gap-8 mb-8">
                <GlassCard className="p-8"><h2 className="text-2xl font-bold text-slate-100 mb-4">About The Project</h2><p className="text-slate-300 leading-relaxed">We are a passionate team of developers and blockchain enthusiasts dedicated to solving a fundamental problem in the freelance economy: the lack of trust. Traditional platforms act as costly intermediaries, holding funds and controlling user reputations. SkillChain removes the middleman, putting power back into the hands of the users. Our smart contracts act as autonomous, unbiased escrow agents, ensuring that freelancers get paid for their work and clients get what they paid for.</p></GlassCard>
                <GlassCard className="p-8"><h2 className="text-2xl font-bold text-slate-100 mb-4">The Team</h2><div className="space-y-4"><div><h3 className="text-lg font-semibold text-indigo-400">Group Members</h3><ul className="list-disc list-inside text-slate-300 mt-2"><li>Pruthviraj Patil</li><li>Varad Jadhav</li><li>Pratik Suryawanshi</li><li>Anish Patil</li></ul></div><div><h3 className="text-lg font-semibold text-indigo-400">Project Guide</h3><p className="text-slate-300 mt-2">Mrs. M.S.Patil</p></div></div></GlassCard>
            </div>
            <GlassCard className="p-8"><h2 className="text-2xl font-bold text-slate-100 mb-4">Our (Decentralized) Office</h2><p className="text-slate-300 leading-relaxed">As a web3-native project, our team is globally distributed. However, our technical operations are based out of:</p><div className="mt-4 font-mono text-indigo-300 bg-slate-900/50 p-4 rounded-lg border border-slate-700"><p>SkillSwap Labs</p><p>RIT,ISLAMPUR</p><p>Maharashtra, 415414</p><p>India</p></div></GlassCard>
        </PageContainer>
    );

    const SkillFeedPage = () => (
         <PageContainer key="feed">
            <div className="text-center mb-16"><h1 className="text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-4">Decentralized Talent Marketplace</h1><p className="max-w-3xl mx-auto text-lg text-slate-400">Discover and collaborate with verified professionals through the power of smart contracts.</p></div>
             <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {skills.map(skill => (
                    <GlassCard key={skill.id} className="p-6 hover:border-indigo-500/80 hover:-translate-y-2">
                        <h3 className="text-xl font-bold text-slate-100">{skill.title}</h3>
                        <p className="text-sm text-slate-400 font-mono mt-1 truncate" title={skill.provider}>{`Provider: ${skill.provider}`}</p>
                        <div className="flex justify-between items-center mt-6">
                            <p className="text-lg font-semibold text-indigo-400">{skill.rate} ETH <span className="text-sm text-slate-500">/ hr</span></p>
                            <button onClick={() => hireProvider(skill)} disabled={isLoading || !walletAddress || skill.provider.toLowerCase() === walletAddress.toLowerCase()} className="px-5 py-2 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-500 transition-all shadow-md shadow-indigo-600/20 disabled:bg-slate-600 disabled:shadow-none">{isLoading ? 'Busy...' : 'Hire'}</button>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </PageContainer>
    );

    const ProfilePage = () => {
        const [name, setName] = useState(userProfile?.name || '');
        const [bio, setBio] = useState(userProfile?.bio || '');
        const [title, setTitle] = useState('');
        const [description, setDescription] = useState('');
        const [rate, setRate] = useState('');
        const handleProfileSubmit = (e) => { e.preventDefault(); createProfile(name, bio); };
        const handleSkillSubmit = (e) => { e.preventDefault(); listNewSkill(title, description, rate); setTitle(''); setDescription(''); setRate(''); };
        if (!userProfile) { return (<PageContainer key="create-profile"><GlassCard className="max-w-lg mx-auto p-8"><h3 className="text-2xl font-bold mb-2 text-slate-100">Create Your On-Chain Profile</h3><p className="text-slate-400 mb-6">This identity is yours forever. Make it count.</p><form onSubmit={handleProfileSubmit}><div className="mb-4"><label className="block text-sm font-medium text-slate-300 mb-1">Name</label><input type="text" value={name} onChange={e => setName(e.target.value)} className="form-input" required /></div><div className="mb-4"><label className="block text-sm font-medium text-slate-300 mb-1">Bio / Tagline</label><textarea value={bio} onChange={e => setBio(e.target.value)} className="form-input" required /></div><button type="submit" disabled={isLoading} className="form-button-primary">{isLoading ? 'Creating...' : 'Create Profile'}</button></form></GlassCard></PageContainer>); }
        return (<PageContainer key="profile-view"><div className="grid lg:grid-cols-5 gap-8"><div className="lg:col-span-2"><GlassCard className="p-8"><h3 className="text-2xl font-bold text-slate-100 mb-4">Your Profile</h3><p className="text-lg font-semibold text-indigo-400">{userProfile.name}</p><p className="text-slate-300 mt-2">{userProfile.bio}</p></GlassCard></div><div className="lg:col-span-3"><GlassCard className="p-8"><h3 className="text-2xl font-bold text-slate-100 mb-6">List a New Skill</h3><form onSubmit={handleSkillSubmit}><div className="mb-4"><input type="text" placeholder="Skill Title (e.g., Solidity Auditing)" value={title} onChange={e => setTitle(e.target.value)} className="form-input" required /></div><div className="mb-4"><textarea placeholder="Brief Description" value={description} onChange={e => setDescription(e.target.value)} className="form-input" required /></div><div className="mb-4"><input type="text" placeholder="Rate in ETH per hour (e.g., 0.1)" value={rate} onChange={e => setRate(e.target.value)} className="form-input" required /></div><button type="submit" disabled={isLoading} className="form-button-primary bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20">{isLoading ? 'Listing...' : 'List Skill'}</button></form></GlassCard></div></div></PageContainer>);
    };
    
    const DashboardPage = () => {
        const jobsAsClient = jobs.filter(j => j.client.toLowerCase() === walletAddress.toLowerCase());
        const jobsAsProvider = jobs.filter(j => j.provider.toLowerCase() === walletAddress.toLowerCase());
        
        const handleReviewClick = (job) => {
            setReviewJob(job);
            setIsReviewModalOpen(true);
        };

        const JobCard = ({job, role}) => (
            <GlassCard className="p-4 flex items-center justify-between hover:border-slate-600">
                <div>
                    <h4 className="font-bold text-slate-200">Job #{job.id}</h4>
                    <p className="text-xs text-slate-400 mt-1 font-mono">{role === 'client' ? `Hired: ${job.provider.slice(0,10)}...` : `Client: ${job.client.slice(0,10)}...`}</p>
                    <p className="text-indigo-400 font-semibold mt-2">{job.amount} ETH</p>
                </div>
                <div className="text-right flex flex-col items-end space-y-2">
                    <StatusPill status={job.status} />
                    {role === 'client' && job.status === 2 && <button onClick={() => confirmJobCompletion(job.id)} disabled={isLoading} className="form-button-sm bg-emerald-600 hover:bg-emerald-500">Confirm</button>}
                    {role === 'provider' && job.status === 1 && <button onClick={() => submitWorkForJob(job.id)} disabled={isLoading} className="form-button-sm bg-blue-600 hover:bg-blue-500">Submit</button>}
                    {job.status === 3 && <button onClick={() => handleReviewClick(job)} disabled={isLoading} className="form-button-sm bg-purple-600 hover:bg-purple-500">Review</button>}
                </div>
            </GlassCard>
        );

        return (
            <PageContainer key="dashboard">
                <h2 className="text-4xl font-bold text-slate-100 mb-8">Dashboard</h2>
                <div className="grid md:grid-cols-2 gap-8">
                    <div>
                        <h3 className="text-xl font-semibold text-slate-300 mb-4">Jobs as Client ({jobsAsClient.length})</h3>
                        <div className="space-y-4">{jobsAsClient.length > 0 ? jobsAsClient.map(job => <JobCard key={job.id} job={job} role="client" />) : <GlassCard className="p-6 text-center text-slate-400">You haven't hired for any jobs yet.</GlassCard>}</div>
                    </div>
                     <div>
                        <h3 className="text-xl font-semibold text-slate-300 mb-4">Jobs as Provider ({jobsAsProvider.length})</h3>
                        <div className="space-y-4">{jobsAsProvider.length > 0 ? jobsAsProvider.map(job => <JobCard key={job.id} job={job} role="provider" />) : <GlassCard className="p-6 text-center text-slate-400">You have no active jobs. List a skill to get hired!</GlassCard>}</div>
                    </div>
                </div>
            </PageContainer>
        );
    };

    // NEW: Review Modal Component
    const ReviewModal = () => {
        const [rating, setRating] = useState(0);
        const [hoverRating, setHoverRating] = useState(0);
        const [comment, setComment] = useState('');

        if (!isReviewModalOpen || !reviewJob) return null;

        const handleSubmit = (e) => {
            e.preventDefault();
            if(rating > 0) {
                leaveReview(reviewJob.id, rating, comment || "No comment");
            } else {
                alert("Please select a star rating.");
            }
        };

        return (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center animate-fade-in-up">
                <GlassCard className="w-full max-w-lg p-8 relative">
                    <button onClick={() => setIsReviewModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">&times;</button>
                    <h2 className="text-2xl font-bold text-slate-100 mb-4">Leave a Review for Job #{reviewJob.id}</h2>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Your Rating</label>
                            <div className="flex space-x-1" onMouseLeave={() => setHoverRating(0)}>
                                {[1, 2, 3, 4, 5].map(star => (
                                    <IconStar 
                                        key={star}
                                        isFilled={star <= rating}
                                        isHovering={star <= hoverRating}
                                        onHover={() => setHoverRating(star)}
                                        onClick={() => setRating(star)}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-slate-300 mb-1">Comment (Optional)</label>
                            <textarea value={comment} onChange={e => setComment(e.target.value)} className="form-input" placeholder="How was your experience?" />
                        </div>
                        <button type="submit" disabled={isLoading} className="form-button-primary bg-purple-600 hover:bg-purple-500 shadow-purple-600/20">
                            {isLoading ? 'Submitting...' : 'Submit Review'}
                        </button>
                    </form>
                </GlassCard>
            </div>
        );
    };

    const renderPage = () => {
        if (!walletAddress && ['dashboard', 'profile'].includes(page)) { return (<PageContainer key="connect-wallet"><GlassCard className="text-center p-12 max-w-lg mx-auto"><h2 className="text-2xl font-bold text-slate-100">Connect Your Wallet</h2><p className="mt-2 text-slate-400 mb-6">Access your dashboard and profile by connecting your web3 wallet.</p><button onClick={connectWallet} disabled={isLoading} className="inline-flex items-center px-6 py-3 text-base font-medium rounded-full text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/50 disabled:bg-slate-600 disabled:shadow-none"><IconWallet /> Connect Now</button></GlassCard></PageContainer>); }
        switch (page) {
            case 'dashboard': return <DashboardPage />;
            case 'profile': return <ProfilePage />;
            case 'about': return <AboutPage />;
            case 'feed':
            default: return <SkillFeedPage />;
        }
    };
    
    return (
        <Fragment>
            <style>{`
                @keyframes pan-background { 0% { transform: translate(0%, 0%) rotate(0deg); } 25% { transform: translate(10%, -10%) rotate(90deg); } 50% { transform: translate(0%, 20%) rotate(180deg); } 75% { transform: translate(-10%, 10%) rotate(270deg); } 100% { transform: translate(0%, 0%) rotate(360deg); } }
                .animate-pan-background { animation: pan-background 50s linear infinite; }
                @keyframes fade-in-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in-up { animation: fade-in-up 0.7s ease-out forwards; }
                .form-input { background-color: rgb(30 41 59 / 0.5); border: 1px solid rgb(51 65 85 / 1); color: rgb(226 232 240 / 1); padding: 0.75rem 1rem; border-radius: 0.5rem; width: 100%; transition: all 0.2s; }
                .form-input:focus { outline: none; border-color: rgb(99 102 241 / 1); box-shadow: 0 0 0 3px rgb(99 102 241 / 0.3); }
                .form-button-primary { width: 100%; padding: 0.75rem 1rem; background-color: rgb(79 70 229 / 1); color: white; font-weight: 600; border-radius: 9999px; transition: all 0.2s; box-shadow: 0 4px 14px 0 rgb(79 70 229 / 0.2); }
                .form-button-primary:hover:not(:disabled) { background-color: rgb(99 102 241 / 1); box-shadow: 0 6px 20px 0 rgb(99 102 241 / 0.3); }
                .form-button-primary:disabled { background-color: rgb(51 65 85 / 1); cursor: not-allowed; box-shadow: none; }
                .form-button-sm { padding: 0.25rem 0.75rem; font-size: 0.875rem; border-radius: 9999px; font-weight: 600; color: white; transition: all 0.2s; }
                .form-button-sm:disabled { background-color: rgb(51 65 85 / 1); cursor: not-allowed; }
            `}</style>
            <div className="bg-slate-900 text-slate-200 min-h-screen font-sans">
                <AnimatedBackground />
                <Header />
                <ReviewModal />
                {errorMessage && (<div className="fixed top-24 right-6 bg-red-800/80 backdrop-blur-md border border-red-500 text-white p-4 rounded-lg shadow-lg z-50 animate-fade-in-up" role="alert"><p className="font-bold">Transaction Error</p><p className="text-sm">{errorMessage}</p></div>)}
                <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-12">{renderPage()}</main>
            </div>
        </Fragment>
    );
}
