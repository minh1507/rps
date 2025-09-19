package vn.vnpay.rs.berps.dto;

import software.amazon.awssdk.services.s3.model.CompletedPart;

public class CompletedPartDto {
    private int partNumber;
    private String eTag;

    public CompletedPartDto() {}

    public CompletedPartDto(int partNumber, String eTag) {
        this.partNumber = partNumber;
        this.eTag = eTag;
    }

    public int getPartNumber() { return partNumber; }
    public void setPartNumber(int partNumber) { this.partNumber = partNumber; }

    public String getETag() { return eTag; }
    public void setETag(String eTag) { this.eTag = eTag; }

    public CompletedPart toCompletedPart() {
        return CompletedPart.builder()
                .partNumber(partNumber)
                .eTag(eTag)
                .build();
    }

    public static CompletedPartDto fromCompletedPart(CompletedPart part) {
        return new CompletedPartDto(part.partNumber(), part.eTag());
    }
}
