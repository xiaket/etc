/// Transcript merging functionality with overlap detection
pub struct TranscriptMerger;

impl TranscriptMerger {
    pub fn new() -> Self {
        Self
    }

    /// Merge transcripts with duplicate removal and automatic overlap detection
    pub fn merge_transcripts(&self, transcripts: Vec<String>) -> String {
        if transcripts.is_empty() {
            return String::new();
        }

        if transcripts.len() == 1 {
            return transcripts[0].clone();
        }

        let mut result = transcripts[0].clone();

        for current in transcripts.iter().skip(1) {
            // Skip empty transcripts
            if current.is_empty() {
                continue;
            }

            let overlap_size = self.find_overlap_size(&result, current);

            if overlap_size == 0 {
                // No overlap found, just append with a space
                result.push(' ');
                result.push_str(current);
            } else {
                // Append only the non-overlapping part of the current transcript
                result.push_str(&current[overlap_size..]);
            }
        }

        result.trim().to_string()
    }

    fn find_overlap_size(&self, previous: &str, current: &str) -> usize {
        const MIN_OVERLAP: usize = 10; // Minimum number of characters to consider as overlap
        const MAX_OVERLAP: usize = 300; // Maximum number of characters to check for overlap

        let max_check_size = MAX_OVERLAP.min(current.len()).min(previous.len());

        // Check for different overlap sizes, starting from larger to smaller
        for size in (MIN_OVERLAP..=max_check_size).rev() {
            if self.has_overlap_at_size(previous, current, size) {
                return size;
            }
        }

        0 // No overlap found
    }

    fn has_overlap_at_size(&self, previous: &str, current: &str, size: usize) -> bool {
        let previous_suffix = previous.chars().skip(previous.len() - size).collect::<String>();
        let current_prefix = current.chars().take(size).collect::<String>();
        
        previous_suffix == current_prefix
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_merger() -> TranscriptMerger {
        TranscriptMerger::new()
    }

    #[test]
    fn test_merge_transcripts_empty() {
        let merger = create_merger();
        assert_eq!(merger.merge_transcripts(vec![]), String::new());
    }

    #[test]
    fn test_merge_transcripts_single() {
        let merger = create_merger();
        assert_eq!(
            merger.merge_transcripts(vec!["Hello world".to_string()]),
            "Hello world"
        );
    }

    #[test]
    fn test_merge_transcripts_no_overlap() {
        let merger = create_merger();
        let transcripts = vec!["Hello".to_string(), "world".to_string()];
        assert_eq!(merger.merge_transcripts(transcripts), "Hello world");
    }

    #[test]
    fn test_merge_transcripts_with_overlap() {
        let merger = create_merger();
        let transcripts = vec!["Hello world".to_string(), "world and universe".to_string()];
        let result = merger.merge_transcripts(transcripts);
        assert_eq!(result, "Hello world world and universe");
    }

    #[test]
    fn test_merge_transcripts_with_space_overlap() {
        let merger = create_merger();
        let transcripts = vec!["Hello world ".to_string(), "world and universe".to_string()];
        let result = merger.merge_transcripts(transcripts);
        assert_eq!(result, "Hello world  world and universe");
    }

    #[test]
    fn test_merge_transcripts_short_strings() {
        let merger = create_merger();
        let transcripts = vec!["Hi".to_string(), "there".to_string()];
        assert_eq!(merger.merge_transcripts(transcripts), "Hi there");
    }

    #[test]
    fn test_merge_transcripts_identical() {
        let merger = create_merger();
        let transcripts = vec!["Same text here".to_string(), "Same text here".to_string()];
        assert_eq!(merger.merge_transcripts(transcripts), "Same text here");
    }

    #[test]
    fn test_merge_transcripts_with_empty() {
        let merger = create_merger();
        let transcripts = vec![
            "Hello world".to_string(),
            "".to_string(),
            "goodbye".to_string(),
        ];
        assert_eq!(merger.merge_transcripts(transcripts), "Hello world goodbye");
    }

    #[test]
    fn test_merge_transcripts_large_overlap() {
        let merger = create_merger();
        let long_text = "This is a very long sentence that should be detected as overlap when it appears at the end of one transcript and the beginning of another";
        let transcripts = vec![
            format!("Start of first transcript. {}", long_text),
            format!("{} End of second transcript.", long_text),
        ];
        let result = merger.merge_transcripts(transcripts);
        assert_eq!(
            result,
            format!(
                "Start of first transcript. {} End of second transcript.",
                long_text
            )
        );
    }

    #[test]
    fn test_find_overlap_size() {
        let merger = create_merger();
        
        // Test with exact overlap (longer than minimum)
        let overlap = merger.find_overlap_size("Hello world test", "world test and universe");
        assert_eq!(overlap, 10); // "world test"
        
        // Test with no overlap
        let overlap = merger.find_overlap_size("Hello", "there");
        assert_eq!(overlap, 0);
        
        // Test with short strings (below minimum overlap)
        let overlap = merger.find_overlap_size("Hi", "i there");
        assert_eq!(overlap, 0); // Below minimum overlap threshold
        
        // Test with short overlap (below minimum)
        let overlap = merger.find_overlap_size("Hello world", "world test");
        assert_eq!(overlap, 0); // "world" is only 5 chars, below minimum of 10
    }

    #[test]
    fn test_has_overlap_at_size() {
        let merger = create_merger();
        
        // Test exact match
        assert!(merger.has_overlap_at_size("Hello world", "world test", 5));
        
        // Test no match
        assert!(!merger.has_overlap_at_size("Hello world", "test world", 5));
        
        // Test different size
        assert!(merger.has_overlap_at_size("Hello world", "orld test", 4));
    }
}